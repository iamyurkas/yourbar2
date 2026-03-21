import { JsonInventoryStorageAdapter, type InventorySnapshotRecord, type InventoryStorageAdapter } from '@/libs/inventory-storage-adapter';
import { type InventoryDeltaSnapshotV3 } from '@/libs/inventory-storage';

const DB_NAME = 'inventory-state.db';
const SQLITE_MIGRATED_FLAG = 'json_snapshot_migrated';
const SQLITE_VERSION_KEY = 'snapshot_version';
const SQLITE_IMPORTED_KEY = 'snapshot_imported';

export interface SqliteDatabaseLike {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: unknown[]): Promise<void>;
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

type OpenDatabase = () => Promise<SqliteDatabaseLike>;

function isDeltaSnapshotV3(snapshot: InventorySnapshotRecord): snapshot is InventoryDeltaSnapshotV3<any, any> {
  return snapshot.version === 3 && 'delta' in snapshot;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  return fallback;
}

function toNumberArray(values: unknown): number[] | undefined {
  if (!Array.isArray(values)) {
    return undefined;
  }

  const normalized = Array.from(new Set(values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.trunc(value))));

  return normalized.length > 0 ? normalized : undefined;
}

function toStringArray(values: unknown): string[] | undefined {
  if (!Array.isArray(values)) {
    return undefined;
  }

  const normalized = Array.from(new Set(values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)));

  return normalized.length > 0 ? normalized : undefined;
}

function parseJsonValue<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function sanitizeSnapshot(snapshot: InventorySnapshotRecord): InventorySnapshotRecord {
  if (!isDeltaSnapshotV3(snapshot)) {
    return {
      version: 3,
      delta: {},
      imported: true,
    };
  }

  return {
    ...snapshot,
    availableIngredientIds: toNumberArray(snapshot.availableIngredientIds),
    shoppingIngredientIds: toNumberArray(snapshot.shoppingIngredientIds),
    partySelectedCocktailKeys: toStringArray(snapshot.partySelectedCocktailKeys),
    bars: Array.isArray(snapshot.bars)
      ? snapshot.bars.map((bar) => ({
        ...bar,
        availableIngredientIds: toNumberArray(bar.availableIngredientIds) ?? [],
        shoppingIngredientIds: toNumberArray(bar.shoppingIngredientIds) ?? [],
      }))
      : undefined,
    imported: toBoolean(snapshot.imported, true),
  };
}

async function createExpoSqliteDatabase(): Promise<SqliteDatabaseLike> {
  const sqlite = await import('expo-sqlite');
  const db = await sqlite.openDatabaseAsync(DB_NAME);

  return {
    execAsync: db.execAsync.bind(db),
    runAsync: async (sql: string, params?: unknown[]) => {
      await db.runAsync(sql, ...(params ?? []));
    },
    getFirstAsync: async <T>(sql: string, params?: unknown[]) => db.getFirstAsync(sql, ...(params ?? [])) as T | null,
    getAllAsync: async <T>(sql: string, params?: unknown[]) => db.getAllAsync(sql, ...(params ?? [])) as T[],
  };
}

export class SqliteInventoryStorageAdapter implements InventoryStorageAdapter {
  private readonly jsonFallback = new JsonInventoryStorageAdapter();

  private dbPromise: Promise<SqliteDatabaseLike> | null = null;

  constructor(private readonly openDatabase: OpenDatabase = createExpoSqliteDatabase) {}

  private async getDb(): Promise<SqliteDatabaseLike> {
    if (!this.dbPromise) {
      this.dbPromise = this.openDatabase().then(async (db) => {
        await this.ensureSchema(db);
        return db;
      });
    }

    return this.dbPromise;
  }

  private async ensureSchema(db: SqliteDatabaseLike): Promise<void> {
    await db.execAsync('PRAGMA journal_mode = WAL;');
    await db.execAsync('PRAGMA synchronous = NORMAL;');
    await db.execAsync('PRAGMA foreign_keys = ON;');

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS cocktails (
        id INTEGER PRIMARY KEY,
        record_json TEXT NOT NULL,
        search_name_normalized TEXT,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
      );

      CREATE TABLE IF NOT EXISTS ingredients (
        id INTEGER PRIMARY KEY,
        record_json TEXT NOT NULL,
        search_name_normalized TEXT,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
      );

      CREATE TABLE IF NOT EXISTS tags (
        kind TEXT NOT NULL,
        id INTEGER NOT NULL,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        PRIMARY KEY (kind, id)
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bars (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bar_state (
        bar_id TEXT NOT NULL,
        ingredient_id INTEGER NOT NULL,
        available INTEGER NOT NULL DEFAULT 0,
        shopping INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (bar_id, ingredient_id),
        FOREIGN KEY (bar_id) REFERENCES bars(id) ON DELETE CASCADE
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
        data_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_cocktails_search_name ON cocktails(search_name_normalized);
      CREATE INDEX IF NOT EXISTS idx_ingredients_search_name ON ingredients(search_name_normalized);
      CREATE INDEX IF NOT EXISTS idx_bar_state_available ON bar_state(bar_id, available, ingredient_id);
      CREATE INDEX IF NOT EXISTS idx_bar_state_shopping ON bar_state(bar_id, shopping, ingredient_id);
      CREATE INDEX IF NOT EXISTS idx_party_selection_key ON party_selection(cocktail_key);
    `);
  }

  async loadState(): Promise<InventorySnapshotRecord | undefined> {
    try {
      const db = await this.getDb();
      await this.migrateFromJsonIfNeeded(db);
      return this.exportSnapshot();
    } catch (error) {
      console.warn('SQLite inventory load failed, using JSON fallback', error);
      return this.jsonFallback.loadState();
    }
  }

  async persistStateDelta(snapshot: InventorySnapshotRecord): Promise<void> {
    try {
      const db = await this.getDb();
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION;');
      try {
        await this.persistSnapshot(db, sanitizeSnapshot(snapshot));
        await db.execAsync('COMMIT;');
      } catch (error) {
        await db.execAsync('ROLLBACK;');
        throw error;
      }
    } catch (error) {
      console.warn('SQLite inventory persist delta failed, using JSON fallback', error);
      await this.jsonFallback.persistStateDelta(snapshot);
    }
  }

  async replaceState(snapshot: InventorySnapshotRecord): Promise<void> {
    try {
      const db = await this.getDb();
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION;');
      try {
        await this.clearAllTables(db);
        await this.persistSnapshot(db, sanitizeSnapshot(snapshot));
        await db.execAsync('COMMIT;');
      } catch (error) {
        await db.execAsync('ROLLBACK;');
        throw error;
      }
    } catch (error) {
      console.warn('SQLite inventory replace state failed, using JSON fallback', error);
      await this.jsonFallback.replaceState(snapshot);
    }
  }

  async clearState(): Promise<void> {
    try {
      const db = await this.getDb();
      await this.clearAllTables(db);
    } catch (error) {
      console.warn('SQLite inventory clear state failed, using JSON fallback', error);
      await this.jsonFallback.clearState();
    }
  }

  async exportSnapshot(): Promise<InventorySnapshotRecord | undefined> {
    try {
      const db = await this.getDb();
      return this.readSnapshot(db);
    } catch (error) {
      console.warn('SQLite inventory export failed, using JSON fallback', error);
      return this.jsonFallback.exportSnapshot();
    }
  }

  async importSnapshot(snapshot: InventorySnapshotRecord): Promise<void> {
    await this.replaceState(snapshot);
  }

  private async migrateFromJsonIfNeeded(db: SqliteDatabaseLike): Promise<void> {
    const migrationFlag = await db.getFirstAsync<{ value_json: string }>(
      'SELECT value_json FROM metadata WHERE key = ? LIMIT 1',
      [SQLITE_MIGRATED_FLAG],
    );

    if (migrationFlag?.value_json === 'true') {
      return;
    }

    const cocktailRow = await db.getFirstAsync<{ id: number }>('SELECT id FROM cocktails LIMIT 1');
    const ingredientRow = await db.getFirstAsync<{ id: number }>('SELECT id FROM ingredients LIMIT 1');

    if (cocktailRow || ingredientRow) {
      await db.runAsync('INSERT OR REPLACE INTO metadata (key, value_json) VALUES (?, ?)', [SQLITE_MIGRATED_FLAG, 'true']);
      return;
    }

    const snapshot = await this.jsonFallback.loadState();
    if (!snapshot) {
      return;
    }

    await db.execAsync('BEGIN IMMEDIATE TRANSACTION;');
    try {
      await this.persistSnapshot(db, sanitizeSnapshot(snapshot));
      await db.runAsync('INSERT OR REPLACE INTO metadata (key, value_json) VALUES (?, ?)', [SQLITE_MIGRATED_FLAG, 'true']);
      await db.execAsync('COMMIT;');
    } catch (error) {
      await db.execAsync('ROLLBACK;');
      throw error;
    }
  }

  private async clearAllTables(db: SqliteDatabaseLike): Promise<void> {
    await db.execAsync(`
      DELETE FROM cocktails;
      DELETE FROM ingredients;
      DELETE FROM tags;
      DELETE FROM settings;
      DELETE FROM bars;
      DELETE FROM bar_state;
      DELETE FROM feedback;
      DELETE FROM party_selection;
      DELETE FROM translation_overrides;
      DELETE FROM metadata;
    `);
  }

  private async persistSnapshot(db: SqliteDatabaseLike, snapshot: InventorySnapshotRecord): Promise<void> {
    const normalized = sanitizeSnapshot(snapshot);
    if (!isDeltaSnapshotV3(normalized)) {
      return;
    }

    const cocktailDelta = normalized.delta.cocktails;
    const ingredientDelta = normalized.delta.ingredients;

    if (cocktailDelta?.deletedIds?.length) {
      for (const id of cocktailDelta.deletedIds) {
        await db.runAsync('DELETE FROM cocktails WHERE id = ?', [id]);
      }
    }

    for (const row of [...(cocktailDelta?.created ?? []), ...(cocktailDelta?.updated ?? [])]) {
      await db.runAsync(
        'INSERT OR REPLACE INTO cocktails (id, record_json, search_name_normalized, updated_at) VALUES (?, ?, ?, strftime(\'%s\',\'now\'))',
          [row.id, JSON.stringify(row), null],
      );
    }

    if (ingredientDelta?.deletedIds?.length) {
      for (const id of ingredientDelta.deletedIds) {
        await db.runAsync('DELETE FROM ingredients WHERE id = ?', [id]);
      }
    }

    for (const row of [...(ingredientDelta?.created ?? []), ...(ingredientDelta?.updated ?? [])]) {
      await db.runAsync(
        'INSERT OR REPLACE INTO ingredients (id, record_json, search_name_normalized, updated_at) VALUES (?, ?, ?, strftime(\'%s\',\'now\'))',
          [row.id, JSON.stringify(row), null],
      );
    }

    await db.runAsync('INSERT OR REPLACE INTO metadata (key, value_json) VALUES (?, ?)', [SQLITE_VERSION_KEY, JSON.stringify(normalized.version)]);
    await db.runAsync('INSERT OR REPLACE INTO metadata (key, value_json) VALUES (?, ?)', [SQLITE_IMPORTED_KEY, JSON.stringify(Boolean(normalized.imported))]);

    await db.runAsync('INSERT OR REPLACE INTO settings (key, value_json) VALUES (?, ?)', ['delta', JSON.stringify(normalized.delta)]);

      const settingsEntries = [
        ['ignoreGarnish', JSON.stringify(normalized.ignoreGarnish ?? true)],
        ['allowAllSubstitutes', JSON.stringify(normalized.allowAllSubstitutes ?? true)],
        ['useImperialUnits', JSON.stringify(normalized.useImperialUnits ?? false)],
        ['keepScreenAwake', JSON.stringify(normalized.keepScreenAwake ?? true)],
        ['shakerSmartFilteringEnabled', JSON.stringify(normalized.shakerSmartFilteringEnabled ?? false)],
        ['showTabCounters', JSON.stringify(normalized.showTabCounters ?? false)],
        ['ratingFilterThreshold', JSON.stringify(normalized.ratingFilterThreshold ?? 1)],
        ['startScreen', JSON.stringify(normalized.startScreen ?? 'cocktails_all')],
        ['appTheme', JSON.stringify(normalized.appTheme ?? 'light')],
        ['appLocale', JSON.stringify(normalized.appLocale ?? 'en-US')],
        ['amazonStoreOverride', JSON.stringify(normalized.amazonStoreOverride ?? null)],
        ['activeBarId', JSON.stringify(normalized.activeBarId ?? '1')],
        ['onboardingStep', JSON.stringify(normalized.onboardingStep ?? 1)],
        ['onboardingCompleted', JSON.stringify(Boolean(normalized.onboardingCompleted))],
        ['onboardingStarterApplied', JSON.stringify(Boolean(normalized.onboardingStarterApplied))],
        ['availableIngredientIds', JSON.stringify(normalized.availableIngredientIds ?? [])],
        ['shoppingIngredientIds', JSON.stringify(normalized.shoppingIngredientIds ?? [])],
      ] as const;

    for (const [key, valueJson] of settingsEntries) {
      await db.runAsync('INSERT OR REPLACE INTO settings (key, value_json) VALUES (?, ?)', [key, valueJson]);
    }

    await db.execAsync('DELETE FROM tags;');
    for (const tag of normalized.customCocktailTags ?? []) {
      await db.runAsync('INSERT OR REPLACE INTO tags (kind, id, name, color) VALUES (?, ?, ?, ?)', ['cocktail', tag.id, tag.name, tag.color]);
    }
    for (const tag of normalized.customIngredientTags ?? []) {
      await db.runAsync('INSERT OR REPLACE INTO tags (kind, id, name, color) VALUES (?, ?, ?, ?)', ['ingredient', tag.id, tag.name, tag.color]);
    }

    await db.execAsync('DELETE FROM feedback;');
    const ratings = normalized.cocktailRatings ?? {};
    const comments = normalized.cocktailComments ?? {};
    const feedbackKeys = new Set([...Object.keys(ratings), ...Object.keys(comments)]);
    for (const key of feedbackKeys) {
      await db.runAsync('INSERT OR REPLACE INTO feedback (cocktail_key, rating, comment) VALUES (?, ?, ?)', [key, ratings[key] ?? null, comments[key] ?? null]);
    }

    await db.execAsync('DELETE FROM party_selection;');
    for (const key of normalized.partySelectedCocktailKeys ?? []) {
      await db.runAsync('INSERT OR REPLACE INTO party_selection (cocktail_key) VALUES (?)', [key]);
    }

    await db.execAsync('DELETE FROM bars;');
    await db.execAsync('DELETE FROM bar_state;');
    for (const bar of normalized.bars ?? []) {
      await db.runAsync('INSERT OR REPLACE INTO bars (id, name) VALUES (?, ?)', [bar.id, bar.name]);

        const available = new Set(bar.availableIngredientIds ?? []);
        const shopping = new Set(bar.shoppingIngredientIds ?? []);
        const ids = new Set([...available, ...shopping]);

      for (const ingredientId of ids) {
        await db.runAsync(
          'INSERT OR REPLACE INTO bar_state (bar_id, ingredient_id, available, shopping) VALUES (?, ?, ?, ?)',
          [bar.id, ingredientId, available.has(ingredientId) ? 1 : 0, shopping.has(ingredientId) ? 1 : 0],
        );
      }
    }

    await db.execAsync('DELETE FROM translation_overrides;');
    const translationOverrides = normalized.translationOverrides as Record<string, unknown> | undefined;
    for (const [locale, data] of Object.entries(translationOverrides ?? {})) {
        await db.runAsync('INSERT OR REPLACE INTO translation_overrides (locale, data_json) VALUES (?, ?)', [locale, JSON.stringify(data ?? {})]);
    }
  }

  private async readSnapshot(db: SqliteDatabaseLike): Promise<InventorySnapshotRecord | undefined> {
    const deltaSetting = await db.getFirstAsync<{ value_json: string }>('SELECT value_json FROM settings WHERE key = ? LIMIT 1', ['delta']);
    if (!deltaSetting) {
      return undefined;
    }

    const metadataVersion = await db.getFirstAsync<{ value_json: string }>('SELECT value_json FROM metadata WHERE key = ? LIMIT 1', [SQLITE_VERSION_KEY]);
    const metadataImported = await db.getFirstAsync<{ value_json: string }>('SELECT value_json FROM metadata WHERE key = ? LIMIT 1', [SQLITE_IMPORTED_KEY]);
    const tags = await db.getAllAsync<{ kind: string; id: number; name: string; color: string }>('SELECT kind, id, name, color FROM tags');
    const settings = await db.getAllAsync<{ key: string; value_json: string }>('SELECT key, value_json FROM settings WHERE key <> ?', ['delta']);
    const feedback = await db.getAllAsync<{ cocktail_key: string; rating: number | null; comment: string | null }>('SELECT cocktail_key, rating, comment FROM feedback');
    const party = await db.getAllAsync<{ cocktail_key: string }>('SELECT cocktail_key FROM party_selection ORDER BY cocktail_key ASC');
    const bars = await db.getAllAsync<{ id: string; name: string }>('SELECT id, name FROM bars ORDER BY id ASC');
    const barState = await db.getAllAsync<{ bar_id: string; ingredient_id: number; available: number; shopping: number }>('SELECT bar_id, ingredient_id, available, shopping FROM bar_state');
    const translationRows = await db.getAllAsync<{ locale: string; data_json: string }>('SELECT locale, data_json FROM translation_overrides');

    const settingsMap = new Map<string, unknown>();
    settings.forEach((row) => settingsMap.set(row.key, parseJsonValue(row.value_json, null)));

    const ratings: Record<string, number> = {};
    const comments: Record<string, string> = {};
    feedback.forEach((row) => {
      if (typeof row.rating === 'number') {
        ratings[row.cocktail_key] = row.rating;
      }
      if (typeof row.comment === 'string' && row.comment.trim()) {
        comments[row.cocktail_key] = row.comment;
      }
    });

    const barStateMap = new Map<string, { availableIngredientIds: number[]; shoppingIngredientIds: number[] }>();
    barState.forEach((row) => {
      const current = barStateMap.get(row.bar_id) ?? { availableIngredientIds: [], shoppingIngredientIds: [] };
      if (row.available) {
        current.availableIngredientIds.push(row.ingredient_id);
      }
      if (row.shopping) {
        current.shoppingIngredientIds.push(row.ingredient_id);
      }
      barStateMap.set(row.bar_id, current);
    });

    const translationOverrides = translationRows.reduce<Record<string, unknown>>((acc, row) => {
      acc[row.locale] = parseJsonValue(row.data_json, {});
      return acc;
    }, {});

    return sanitizeSnapshot({
      version: parseJsonValue(metadataVersion?.value_json, 3),
      imported: parseJsonValue(metadataImported?.value_json, true),
      delta: parseJsonValue(deltaSetting.value_json, {}),
      customCocktailTags: tags.filter((tag) => tag.kind === 'cocktail').map((tag) => ({ id: tag.id, name: tag.name, color: tag.color })),
      customIngredientTags: tags.filter((tag) => tag.kind === 'ingredient').map((tag) => ({ id: tag.id, name: tag.name, color: tag.color })),
      availableIngredientIds: toNumberArray(settingsMap.get('availableIngredientIds')),
      shoppingIngredientIds: toNumberArray(settingsMap.get('shoppingIngredientIds')),
      cocktailRatings: Object.keys(ratings).length > 0 ? ratings : undefined,
      cocktailComments: Object.keys(comments).length > 0 ? comments : undefined,
      partySelectedCocktailKeys: party.map((row) => row.cocktail_key),
      ignoreGarnish: toBoolean(settingsMap.get('ignoreGarnish'), true),
      allowAllSubstitutes: toBoolean(settingsMap.get('allowAllSubstitutes'), true),
      useImperialUnits: toBoolean(settingsMap.get('useImperialUnits'), false),
      keepScreenAwake: toBoolean(settingsMap.get('keepScreenAwake'), true),
      shakerSmartFilteringEnabled: toBoolean(settingsMap.get('shakerSmartFilteringEnabled'), false),
      showTabCounters: toBoolean(settingsMap.get('showTabCounters'), false),
      ratingFilterThreshold: Number(settingsMap.get('ratingFilterThreshold') ?? 1),
      startScreen: String(settingsMap.get('startScreen') ?? 'cocktails_all'),
      appTheme: String(settingsMap.get('appTheme') ?? 'light'),
      appLocale: String(settingsMap.get('appLocale') ?? 'en-US'),
      amazonStoreOverride: settingsMap.get('amazonStoreOverride') == null ? null : String(settingsMap.get('amazonStoreOverride')),
      bars: bars.map((bar) => ({
        id: bar.id,
        name: bar.name,
        availableIngredientIds: barStateMap.get(bar.id)?.availableIngredientIds ?? [],
        shoppingIngredientIds: barStateMap.get(bar.id)?.shoppingIngredientIds ?? [],
      })),
      activeBarId: String(settingsMap.get('activeBarId') ?? '1'),
      onboardingStep: Number(settingsMap.get('onboardingStep') ?? 1),
      onboardingCompleted: toBoolean(settingsMap.get('onboardingCompleted'), false),
      onboardingStarterApplied: toBoolean(settingsMap.get('onboardingStarterApplied'), false),
      translationOverrides,
    });
  }
}

export function createInventoryStorageAdapter(useSqliteStorage: boolean): InventoryStorageAdapter {
  if (useSqliteStorage) {
    return new SqliteInventoryStorageAdapter();
  }

  return new JsonInventoryStorageAdapter();
}
