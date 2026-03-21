import * as FileSystem from 'expo-file-system/legacy';

import {
  type InventorySnapshot,
  type InventoryDeltaSnapshotV3,
  loadInventorySnapshot,
  persistInventorySnapshot,
} from '@/libs/inventory-storage';
import type { Bar } from '@/providers/inventory-types';

const SQLITE_DB_NAME = 'inventory-state.db';
const SQLITE_MIGRATION_MARKER_FILENAME = 'inventory-sqlite-migrated.flag';

const SQLITE_ENABLED_FLAG = process.env.EXPO_PUBLIC_USE_SQLITE_STORAGE === '1';

type SqliteDatabase = {
  execAsync: (sql: string) => Promise<void>;
  runAsync: (sql: string, ...params: unknown[]) => Promise<void>;
  getFirstAsync: <T>(sql: string, ...params: unknown[]) => Promise<T | null>;
  getAllAsync: <T>(sql: string, ...params: unknown[]) => Promise<T[]>;
  closeAsync?: () => Promise<void>;
};

type SqliteModule = {
  openDatabaseAsync: (name: string) => Promise<SqliteDatabase>;
};

type StorageMetadataRow = { value: string | null };

type InventoryRow = {
  entity_id: number;
  search_name_normalized: string | null;
  data: string;
};

type TableInfoRow = {
  name: string;
  notnull?: number;
};

function resolveMigrationMarkerPath(): string | undefined {
  const baseDirectory = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
  return baseDirectory ? `${baseDirectory.replace(/\/?$/, '/')}${SQLITE_MIGRATION_MARKER_FILENAME}` : undefined;
}

async function hasCompletedJsonMigration(): Promise<boolean> {
  const markerPath = resolveMigrationMarkerPath();
  if (!markerPath) {
    return false;
  }

  const info = await FileSystem.getInfoAsync(markerPath);
  return info.exists;
}

async function markJsonMigrationComplete(): Promise<void> {
  const markerPath = resolveMigrationMarkerPath();
  if (!markerPath) {
    return;
  }

  await FileSystem.writeAsStringAsync(markerPath, String(Date.now()));
}

async function openSqliteModule(): Promise<SqliteModule | null> {
  if (!SQLITE_ENABLED_FLAG) {
    return null;
  }

  try {
    return (await import('expo-sqlite')) as SqliteModule;
  } catch (error) {
    console.warn('SQLite storage requested but expo-sqlite is unavailable, falling back to JSON snapshot', error);
    return null;
  }
}

function normalizeId(value: unknown): number | null {
  const numeric = Number(value ?? Number.NaN);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Math.trunc(numeric);
}

function getEntityIds(items: unknown[] | undefined): number[] {
  return (items ?? [])
    .map((entry) => normalizeId((entry as { id?: number }).id))
    .filter((entry): entry is number => entry != null);
}

function parseJsonSafe<T>(input: string | null | undefined, fallback: T): T {
  if (!input) {
    return fallback;
  }

  try {
    return JSON.parse(input) as T;
  } catch {
    return fallback;
  }
}

async function ensureColumnExists(
  db: SqliteDatabase,
  tableName: string,
  columnName: string,
  columnSql: string,
): Promise<void> {
  const columns = await db.getAllAsync<TableInfoRow>(`PRAGMA table_info(${tableName})`);
  if (columns.some((column) => column.name === columnName)) {
    return;
  }

  await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnSql}`);
}

function buildLegacyIdArrayExpression(flagColumn: string): string {
  return `'[' || COALESCE(group_concat(CASE WHEN COALESCE(${flagColumn}, 0) = 1 THEN CAST(ingredient_id AS TEXT) END), '') || ']'`;
}

async function ensureBarStateSchemaCompatibility(db: SqliteDatabase): Promise<void> {
  const columns = await db.getAllAsync<TableInfoRow>('PRAGMA table_info(bar_state)');
  if (columns.length === 0) {
    return;
  }

  const columnNames = new Set(columns.map((column) => column.name));
  const hasLegacyIngredientId = columnNames.has('ingredient_id');
  const hasModernColumns = columnNames.has('available_ingredient_ids') && columnNames.has('shopping_ingredient_ids');

  if (!hasLegacyIngredientId && hasModernColumns) {
    return;
  }

  const canAggregateLegacyRows = columnNames.has('is_available') && columnNames.has('is_shopping');
  const populateNewTableSql = canAggregateLegacyRows
    ? `
      INSERT INTO bar_state_next (bar_id, available_ingredient_ids, shopping_ingredient_ids)
      SELECT
        bar_id,
        ${buildLegacyIdArrayExpression('is_available')} AS available_ingredient_ids,
        ${buildLegacyIdArrayExpression('is_shopping')} AS shopping_ingredient_ids
      FROM bar_state
      WHERE bar_id IS NOT NULL AND TRIM(bar_id) <> ''
      GROUP BY bar_id;
    `
    : `
      INSERT INTO bar_state_next (bar_id, available_ingredient_ids, shopping_ingredient_ids)
      SELECT
        bar_id,
        COALESCE(available_ingredient_ids, '[]'),
        COALESCE(shopping_ingredient_ids, '[]')
      FROM bar_state
      WHERE bar_id IS NOT NULL AND TRIM(bar_id) <> '';
    `;

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS bar_state_next (
      bar_id TEXT PRIMARY KEY,
      available_ingredient_ids TEXT NOT NULL,
      shopping_ingredient_ids TEXT NOT NULL,
      FOREIGN KEY(bar_id) REFERENCES bars(bar_id) ON DELETE CASCADE
    );
    DELETE FROM bar_state_next;
    ${populateNewTableSql}
    DROP TABLE bar_state;
    ALTER TABLE bar_state_next RENAME TO bar_state;
  `);
}

async function dedupeRowsByKey(
  db: SqliteDatabase,
  tableName: string,
  keyColumn: string,
): Promise<void> {
  await db.execAsync(`
    DELETE FROM ${tableName}
    WHERE ${keyColumn} IS NOT NULL
      AND rowid NOT IN (
        SELECT MAX(rowid)
        FROM ${tableName}
        WHERE ${keyColumn} IS NOT NULL
        GROUP BY ${keyColumn}
      );
  `);
}

async function ensureSchema(db: SqliteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA temp_store = MEMORY;
    PRAGMA cache_size = -8000;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS cocktails (
      entity_id INTEGER PRIMARY KEY,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ingredients (
      entity_id INTEGER PRIMARY KEY,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      entity_type TEXT NOT NULL,
      tag_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      PRIMARY KEY (entity_type, tag_id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bars (
      bar_id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bar_state (
      bar_id TEXT PRIMARY KEY,
      available_ingredient_ids TEXT NOT NULL,
      shopping_ingredient_ids TEXT NOT NULL,
      FOREIGN KEY(bar_id) REFERENCES bars(bar_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS feedback (
      cocktail_key TEXT PRIMARY KEY,
      rating INTEGER,
      comment TEXT
    );

    CREATE TABLE IF NOT EXISTS party_selection (
      cocktail_key TEXT PRIMARY KEY
    );

    CREATE TABLE IF NOT EXISTS translation_overrides (
      locale TEXT PRIMARY KEY,
      payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS storage_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  await ensureBarStateSchemaCompatibility(db);

  await ensureColumnExists(db, 'cocktails', 'search_name_normalized', 'TEXT');
  await ensureColumnExists(db, 'cocktails', 'entity_id', 'INTEGER');
  await ensureColumnExists(db, 'cocktails', 'data', 'TEXT');
  await ensureColumnExists(db, 'ingredients', 'search_name_normalized', 'TEXT');
  await ensureColumnExists(db, 'ingredients', 'entity_id', 'INTEGER');
  await ensureColumnExists(db, 'ingredients', 'data', 'TEXT');
  await ensureColumnExists(db, 'bars', 'bar_id', 'TEXT');
  await ensureColumnExists(db, 'bars', 'name', 'TEXT');
  await ensureColumnExists(db, 'bar_state', 'bar_id', 'TEXT');
  await ensureColumnExists(db, 'bar_state', 'available_ingredient_ids', 'TEXT');
  await ensureColumnExists(db, 'bar_state', 'shopping_ingredient_ids', 'TEXT');
  await ensureColumnExists(db, 'feedback', 'cocktail_key', 'TEXT');
  await ensureColumnExists(db, 'feedback', 'rating', 'INTEGER');
  await ensureColumnExists(db, 'feedback', 'comment', 'TEXT');
  await ensureColumnExists(db, 'party_selection', 'cocktail_key', 'TEXT');
  await ensureColumnExists(db, 'translation_overrides', 'locale', 'TEXT');
  await ensureColumnExists(db, 'translation_overrides', 'payload', 'TEXT');
  await ensureColumnExists(db, 'settings', 'key', 'TEXT');
  await ensureColumnExists(db, 'settings', 'value', 'TEXT');
  await ensureColumnExists(db, 'tags', 'entity_type', 'TEXT');
  await ensureColumnExists(db, 'tags', 'tag_id', 'INTEGER');
  await ensureColumnExists(db, 'tags', 'name', 'TEXT');
  await ensureColumnExists(db, 'tags', 'color', 'TEXT');
  await ensureColumnExists(db, 'storage_meta', 'key', 'TEXT');
  await ensureColumnExists(db, 'storage_meta', 'value', 'TEXT');

  await dedupeRowsByKey(db, 'cocktails', 'entity_id');
  await dedupeRowsByKey(db, 'ingredients', 'entity_id');
  await dedupeRowsByKey(db, 'bars', 'bar_id');
  await dedupeRowsByKey(db, 'bar_state', 'bar_id');
  await dedupeRowsByKey(db, 'feedback', 'cocktail_key');
  await dedupeRowsByKey(db, 'party_selection', 'cocktail_key');
  await dedupeRowsByKey(db, 'translation_overrides', 'locale');
  await dedupeRowsByKey(db, 'settings', 'key');
  await dedupeRowsByKey(db, 'storage_meta', 'key');

  await db.execAsync(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_cocktails_entity_id ON cocktails(entity_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredients_entity_id ON ingredients(entity_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bars_bar_id ON bars(bar_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bar_state_bar_id ON bar_state(bar_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_cocktail_key ON feedback(cocktail_key);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_party_selection_cocktail_key ON party_selection(cocktail_key);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_translation_overrides_locale ON translation_overrides(locale);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_storage_meta_key ON storage_meta(key);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_entity_tag ON tags(entity_type, tag_id);
    CREATE INDEX IF NOT EXISTS idx_cocktails_search_name ON cocktails(search_name_normalized);
    CREATE INDEX IF NOT EXISTS idx_ingredients_search_name ON ingredients(search_name_normalized);
    CREATE INDEX IF NOT EXISTS idx_feedback_rating ON feedback(rating);
    CREATE INDEX IF NOT EXISTS idx_party_selection_key ON party_selection(cocktail_key);
  `);
}

async function persistTags(db: SqliteDatabase, snapshot: InventoryDeltaSnapshotV3<unknown, unknown>): Promise<void> {
  await db.runAsync('DELETE FROM tags');

  for (const tag of snapshot.customCocktailTags ?? []) {
    await db.runAsync(
      'INSERT INTO tags (entity_type, tag_id, name, color) VALUES (?, ?, ?, ?)',
      'cocktail',
      tag.id,
      tag.name,
      tag.color,
    );
  }

  for (const tag of snapshot.customIngredientTags ?? []) {
    await db.runAsync(
      'INSERT INTO tags (entity_type, tag_id, name, color) VALUES (?, ?, ?, ?)',
      'ingredient',
      tag.id,
      tag.name,
      tag.color,
    );
  }
}

async function persistBars(db: SqliteDatabase, bars: Bar[] | undefined, activeBarId: string | undefined): Promise<void> {
  await db.runAsync('DELETE FROM bar_state');
  await db.runAsync('DELETE FROM bars');

  const persistedBarIds: string[] = [];
  for (const bar of bars ?? []) {
    const normalizedBarId = typeof bar.id === 'string' ? bar.id.trim() : '';
    if (!normalizedBarId) {
      continue;
    }

    const normalizedName = typeof bar.name === 'string' && bar.name.trim().length > 0 ? bar.name.trim() : 'My Bar';
    await db.runAsync('INSERT INTO bars (bar_id, name) VALUES (?, ?)', normalizedBarId, normalizedName);
    await db.runAsync(
      'INSERT INTO bar_state (bar_id, available_ingredient_ids, shopping_ingredient_ids) VALUES (?, ?, ?)',
      normalizedBarId,
      JSON.stringify(bar.availableIngredientIds ?? []),
      JSON.stringify(bar.shoppingIngredientIds ?? []),
    );
    persistedBarIds.push(normalizedBarId);
  }

  const normalizedActiveBarId = typeof activeBarId === 'string' ? activeBarId.trim() : '';
  const resolvedActiveBarId = normalizedActiveBarId && persistedBarIds.includes(normalizedActiveBarId)
    ? normalizedActiveBarId
    : (persistedBarIds[0] ?? '');

  await db.runAsync('INSERT OR REPLACE INTO storage_meta (key, value) VALUES (?, ?)', 'active_bar_id', resolvedActiveBarId);
}

async function persistFeedback(
  db: SqliteDatabase,
  ratings: Record<string, number> | undefined,
  comments: Record<string, string> | undefined,
): Promise<void> {
  await db.runAsync('DELETE FROM feedback');

  const keys = new Set<string>([
    ...Object.keys(ratings ?? {}),
    ...Object.keys(comments ?? {}),
  ]);

  for (const key of keys) {
    await db.runAsync(
      'INSERT INTO feedback (cocktail_key, rating, comment) VALUES (?, ?, ?)',
      key,
      ratings?.[key] ?? null,
      comments?.[key] ?? null,
    );
  }
}

async function persistPartySelection(db: SqliteDatabase, keys: string[] | undefined): Promise<void> {
  await db.runAsync('DELETE FROM party_selection');

  for (const key of keys ?? []) {
    await db.runAsync('INSERT INTO party_selection (cocktail_key) VALUES (?)', key);
  }
}

async function persistTranslationOverrides(db: SqliteDatabase, overrides: unknown): Promise<void> {
  await db.runAsync('DELETE FROM translation_overrides');

  if (!overrides || typeof overrides !== 'object') {
    return;
  }

  for (const [locale, payload] of Object.entries(overrides as Record<string, unknown>)) {
    await db.runAsync(
      'INSERT INTO translation_overrides (locale, payload) VALUES (?, ?)',
      locale,
      JSON.stringify(payload ?? {}),
    );
  }
}

async function persistSettings(db: SqliteDatabase, snapshot: InventoryDeltaSnapshotV3<unknown, unknown>): Promise<void> {
  const settings = {
    imported: snapshot.imported ?? false,
    ignoreGarnish: snapshot.ignoreGarnish ?? true,
    allowAllSubstitutes: snapshot.allowAllSubstitutes ?? true,
    useImperialUnits: snapshot.useImperialUnits ?? false,
    keepScreenAwake: snapshot.keepScreenAwake ?? true,
    shakerSmartFilteringEnabled: snapshot.shakerSmartFilteringEnabled ?? false,
    showTabCounters: snapshot.showTabCounters ?? false,
    ratingFilterThreshold: snapshot.ratingFilterThreshold ?? 1,
    startScreen: snapshot.startScreen ?? 'cocktails_all',
    appTheme: snapshot.appTheme ?? 'light',
    appLocale: snapshot.appLocale ?? 'en',
    amazonStoreOverride: snapshot.amazonStoreOverride ?? null,
    onboardingStep: snapshot.onboardingStep ?? 1,
    onboardingCompleted: snapshot.onboardingCompleted ?? false,
    onboardingStarterApplied: snapshot.onboardingStarterApplied ?? false,
    availableIngredientIds: snapshot.availableIngredientIds ?? [],
    shoppingIngredientIds: snapshot.shoppingIngredientIds ?? [],
  };

  for (const [key, value] of Object.entries(settings)) {
    await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', key, JSON.stringify(value));
  }
}

async function upsertInventoryRows(
  db: SqliteDatabase,
  table: 'cocktails' | 'ingredients',
  created: unknown[] | undefined,
  updated: unknown[] | undefined,
  deletedIds: number[] | undefined,
): Promise<void> {
  for (const id of deletedIds ?? []) {
    await db.runAsync(`DELETE FROM ${table} WHERE entity_id = ?`, id);
  }

  for (const item of [...(created ?? []), ...(updated ?? [])]) {
    const entityId = normalizeId((item as { id?: number }).id);
    if (entityId == null) {
      continue;
    }

    await db.runAsync(
      `INSERT OR REPLACE INTO ${table} (entity_id, search_name_normalized, data) VALUES (?, ?, ?)`,
      entityId,
      (item as { searchNameNormalized?: string }).searchNameNormalized ?? null,
      JSON.stringify(item),
    );
  }
}

export interface InventoryStorageAdapter {
  loadState<TCocktail, TIngredient>(): Promise<InventorySnapshot<TCocktail, TIngredient> | undefined>;
  persistStateDelta<TCocktail, TIngredient>(snapshot: InventoryDeltaSnapshotV3<TCocktail, TIngredient>): Promise<void>;
  replaceState<TCocktail, TIngredient>(snapshot: InventorySnapshot<TCocktail, TIngredient>): Promise<void>;
  clearState(): Promise<void>;
  exportSnapshot<TCocktail, TIngredient>(): Promise<InventorySnapshot<TCocktail, TIngredient> | undefined>;
  importSnapshot<TCocktail, TIngredient>(snapshot: InventorySnapshot<TCocktail, TIngredient>): Promise<void>;
}

class JsonInventoryStorageAdapter implements InventoryStorageAdapter {
  async loadState<TCocktail, TIngredient>(): Promise<InventorySnapshot<TCocktail, TIngredient> | undefined> {
    return loadInventorySnapshot<TCocktail, TIngredient>();
  }



  async persistStateDelta<TCocktail, TIngredient>(snapshot: InventoryDeltaSnapshotV3<TCocktail, TIngredient>): Promise<void> {
    await persistInventorySnapshot(snapshot);
  }

  async replaceState<TCocktail, TIngredient>(snapshot: InventorySnapshot<TCocktail, TIngredient>): Promise<void> {
    await persistInventorySnapshot(snapshot);
  }

  async clearState(): Promise<void> {
    await persistInventorySnapshot({ version: 3, delta: {} });
  }

  async exportSnapshot<TCocktail, TIngredient>(): Promise<InventorySnapshot<TCocktail, TIngredient> | undefined> {
    return loadInventorySnapshot<TCocktail, TIngredient>();
  }

  async importSnapshot<TCocktail, TIngredient>(snapshot: InventorySnapshot<TCocktail, TIngredient>): Promise<void> {
    await persistInventorySnapshot(snapshot);
  }
}

class SqliteInventoryStorageAdapter implements InventoryStorageAdapter {
  private dbPromise: Promise<SqliteDatabase>;

  constructor(sqliteModule: SqliteModule) {
    this.dbPromise = sqliteModule.openDatabaseAsync(SQLITE_DB_NAME);
  }

  private async getDb(): Promise<SqliteDatabase> {
    const db = await this.dbPromise;
    await ensureSchema(db);
    return db;
  }

  private async runTransaction(db: SqliteDatabase, callback: () => Promise<void>): Promise<void> {
    await db.execAsync('BEGIN IMMEDIATE TRANSACTION;');
    try {
      await callback();
      await db.execAsync('COMMIT;');
    } catch (error) {
      await db.execAsync('ROLLBACK;');
      throw error;
    }
  }

  private async getStoredVersion(db: SqliteDatabase): Promise<number> {
    const row = await db.getFirstAsync<StorageMetadataRow>('SELECT value FROM storage_meta WHERE key = ?', 'snapshot_version');
    const parsed = Number(row?.value ?? Number.NaN);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : 3;
  }

  private async migrateFromJsonIfNeeded(db: SqliteDatabase): Promise<void> {
    const hasCocktail = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM cocktails');
    if ((hasCocktail?.count ?? 0) > 0) {
      return;
    }

    if (await hasCompletedJsonMigration()) {
      return;
    }

    const jsonSnapshot = await loadInventorySnapshot<unknown, unknown>();
    if (!jsonSnapshot) {
      await markJsonMigrationComplete();
      return;
    }

    await this.replaceState(jsonSnapshot);
    await markJsonMigrationComplete();
  }

  async loadState<TCocktail, TIngredient>(): Promise<InventorySnapshot<TCocktail, TIngredient> | undefined> {
    const db = await this.getDb();
    await this.migrateFromJsonIfNeeded(db);
    return this.exportSnapshot<TCocktail, TIngredient>();
  }


  private async persistDeltaInTransaction(
    db: SqliteDatabase,
    snapshot: InventoryDeltaSnapshotV3<unknown, unknown>,
  ): Promise<void> {
    await upsertInventoryRows(
      db,
      'cocktails',
      snapshot.delta.cocktails?.created as unknown[] | undefined,
      snapshot.delta.cocktails?.updated as unknown[] | undefined,
      snapshot.delta.cocktails?.deletedIds,
    );
    await upsertInventoryRows(
      db,
      'ingredients',
      snapshot.delta.ingredients?.created as unknown[] | undefined,
      snapshot.delta.ingredients?.updated as unknown[] | undefined,
      snapshot.delta.ingredients?.deletedIds,
    );
    await persistTags(db, snapshot);
    await persistSettings(db, snapshot);
    await persistBars(db, snapshot.bars, snapshot.activeBarId);
    await persistFeedback(db, snapshot.cocktailRatings, snapshot.cocktailComments);
    await persistPartySelection(db, snapshot.partySelectedCocktailKeys);
    await persistTranslationOverrides(db, snapshot.translationOverrides);
    await db.runAsync('INSERT OR REPLACE INTO storage_meta (key, value) VALUES (?, ?)', 'snapshot_version', String(snapshot.version ?? 3));
  }

  async persistStateDelta<TCocktail, TIngredient>(snapshot: InventoryDeltaSnapshotV3<TCocktail, TIngredient>): Promise<void> {
    const db = await this.getDb();

    await this.runTransaction(db, async () => {
      await this.persistDeltaInTransaction(db, snapshot as InventoryDeltaSnapshotV3<unknown, unknown>);
    });
  }

  async replaceState<TCocktail, TIngredient>(snapshot: InventorySnapshot<TCocktail, TIngredient>): Promise<void> {
    if (snapshot.version !== 3 || !('delta' in snapshot)) {
      await persistInventorySnapshot(snapshot);
      return;
    }

    const db = await this.getDb();
    await this.runTransaction(db, async () => {
      await db.runAsync('DELETE FROM cocktails');
      await db.runAsync('DELETE FROM ingredients');
      await db.runAsync('DELETE FROM tags');
      await db.runAsync('DELETE FROM settings');
      await db.runAsync('DELETE FROM bars');
      await db.runAsync('DELETE FROM bar_state');
      await db.runAsync('DELETE FROM feedback');
      await db.runAsync('DELETE FROM party_selection');
      await db.runAsync('DELETE FROM translation_overrides');

      await this.persistDeltaInTransaction(db, snapshot as InventoryDeltaSnapshotV3<unknown, unknown>);
    });
  }

  async clearState(): Promise<void> {
    const db = await this.getDb();
    await this.runTransaction(db, async () => {
      await db.runAsync('DELETE FROM cocktails');
      await db.runAsync('DELETE FROM ingredients');
      await db.runAsync('DELETE FROM tags');
      await db.runAsync('DELETE FROM settings');
      await db.runAsync('DELETE FROM bars');
      await db.runAsync('DELETE FROM bar_state');
      await db.runAsync('DELETE FROM feedback');
      await db.runAsync('DELETE FROM party_selection');
      await db.runAsync('DELETE FROM translation_overrides');
      await db.runAsync('DELETE FROM storage_meta');
    });
  }

  async exportSnapshot<TCocktail, TIngredient>(): Promise<InventorySnapshot<TCocktail, TIngredient> | undefined> {
    const db = await this.getDb();

    const cocktailRows = await db.getAllAsync<InventoryRow>('SELECT entity_id, search_name_normalized, data FROM cocktails ORDER BY search_name_normalized');
    const ingredientRows = await db.getAllAsync<InventoryRow>('SELECT entity_id, search_name_normalized, data FROM ingredients ORDER BY search_name_normalized');
    const feedbackRows = await db.getAllAsync<{ cocktail_key: string; rating: number | null; comment: string | null }>('SELECT cocktail_key, rating, comment FROM feedback');
    const partyRows = await db.getAllAsync<{ cocktail_key: string }>('SELECT cocktail_key FROM party_selection');
    const tagsRows = await db.getAllAsync<{ entity_type: string; tag_id: number; name: string; color: string }>('SELECT entity_type, tag_id, name, color FROM tags ORDER BY tag_id');
    const barRows = await db.getAllAsync<{ bar_id: string; name: string }>('SELECT bar_id, name FROM bars ORDER BY rowid');
    const barStateRows = await db.getAllAsync<{ bar_id: string; available_ingredient_ids: string; shopping_ingredient_ids: string }>('SELECT bar_id, available_ingredient_ids, shopping_ingredient_ids FROM bar_state');
    const translationRows = await db.getAllAsync<{ locale: string; payload: string }>('SELECT locale, payload FROM translation_overrides');
    const settingsRows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');

    const settingsMap = new Map(settingsRows.map((row) => [row.key, row.value]));

    const cocktailRatings: Record<string, number> = {};
    const cocktailComments: Record<string, string> = {};
    feedbackRows.forEach((row) => {
      if (row.rating != null) {
        cocktailRatings[row.cocktail_key] = row.rating;
      }
      if (row.comment) {
        cocktailComments[row.cocktail_key] = row.comment;
      }
    });

    const barsById = new Map(barRows.map((row) => [row.bar_id, row]));
    const barStateById = new Map(barStateRows.map((row) => [row.bar_id, row]));

    const bars: Bar[] = Array.from(barsById.values()).map((bar) => {
      const state = barStateById.get(bar.bar_id);
      return {
        id: bar.bar_id,
        name: bar.name,
        availableIngredientIds: parseJsonSafe<number[]>(state?.available_ingredient_ids, []),
        shoppingIngredientIds: parseJsonSafe<number[]>(state?.shopping_ingredient_ids, []),
      };
    });

    const translationOverrides = translationRows.reduce<Record<string, unknown>>((acc, row) => {
      acc[row.locale] = parseJsonSafe(row.payload, {});
      return acc;
    }, {});

    const customCocktailTags = tagsRows.filter((row) => row.entity_type === 'cocktail').map((row) => ({ id: row.tag_id, name: row.name, color: row.color }));
    const customIngredientTags = tagsRows.filter((row) => row.entity_type === 'ingredient').map((row) => ({ id: row.tag_id, name: row.name, color: row.color }));

    const cocktails = cocktailRows.map((row) => parseJsonSafe<TCocktail>(row.data, {} as TCocktail));
    const ingredients = ingredientRows.map((row) => parseJsonSafe<TIngredient>(row.data, {} as TIngredient));

    const snapshot = {
      version: (await this.getStoredVersion(db)) as 3,
      delta: {
        cocktails: { created: cocktails, updated: [], deletedIds: [] },
        ingredients: { created: ingredients, updated: [], deletedIds: [] },
      },
      imported: parseJsonSafe<boolean>(settingsMap.get('imported'), false),
      customCocktailTags,
      customIngredientTags,
      availableIngredientIds: parseJsonSafe<number[]>(settingsMap.get('availableIngredientIds'), []),
      shoppingIngredientIds: parseJsonSafe<number[]>(settingsMap.get('shoppingIngredientIds'), []),
      cocktailRatings,
      cocktailComments,
      partySelectedCocktailKeys: partyRows.map((row) => row.cocktail_key),
      ignoreGarnish: parseJsonSafe<boolean>(settingsMap.get('ignoreGarnish'), true),
      allowAllSubstitutes: parseJsonSafe<boolean>(settingsMap.get('allowAllSubstitutes'), true),
      useImperialUnits: parseJsonSafe<boolean>(settingsMap.get('useImperialUnits'), false),
      keepScreenAwake: parseJsonSafe<boolean>(settingsMap.get('keepScreenAwake'), true),
      shakerSmartFilteringEnabled: parseJsonSafe<boolean>(settingsMap.get('shakerSmartFilteringEnabled'), false),
      showTabCounters: parseJsonSafe<boolean>(settingsMap.get('showTabCounters'), false),
      ratingFilterThreshold: parseJsonSafe<number>(settingsMap.get('ratingFilterThreshold'), 1),
      startScreen: parseJsonSafe<string>(settingsMap.get('startScreen'), 'cocktails_all'),
      appTheme: parseJsonSafe<string>(settingsMap.get('appTheme'), 'light'),
      appLocale: parseJsonSafe<string>(settingsMap.get('appLocale'), 'en'),
      amazonStoreOverride: parseJsonSafe<string | null>(settingsMap.get('amazonStoreOverride'), null),
      onboardingStep: parseJsonSafe<number>(settingsMap.get('onboardingStep'), 1),
      onboardingCompleted: parseJsonSafe<boolean>(settingsMap.get('onboardingCompleted'), false),
      onboardingStarterApplied: parseJsonSafe<boolean>(settingsMap.get('onboardingStarterApplied'), false),
      translationOverrides,
      bars,
      activeBarId: parseJsonSafe<string>(
        (await db.getFirstAsync<StorageMetadataRow>('SELECT value FROM storage_meta WHERE key = ?', 'active_bar_id'))?.value,
        '',
      ),
    } satisfies InventoryDeltaSnapshotV3<TCocktail, TIngredient>;

    return snapshot;
  }

  async importSnapshot<TCocktail, TIngredient>(snapshot: InventorySnapshot<TCocktail, TIngredient>): Promise<void> {
    await this.replaceState(snapshot);
  }
}

let storageAdapterPromise: Promise<InventoryStorageAdapter> | undefined;

export async function getInventoryStorageAdapter(): Promise<InventoryStorageAdapter> {
  if (!storageAdapterPromise) {
    storageAdapterPromise = (async () => {
      const sqliteModule = await openSqliteModule();
      if (!sqliteModule) {
        return new JsonInventoryStorageAdapter();
      }

      return new SqliteInventoryStorageAdapter(sqliteModule);
    })();
  }

  return storageAdapterPromise;
}

export function __internal() {
  return {
    SQLITE_ENABLED_FLAG,
    getEntityIds,
    parseJsonSafe,
    normalizeId,
    JsonInventoryStorageAdapter,
    SqliteInventoryStorageAdapter,
  };
}
