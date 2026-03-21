import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import type {
  CocktailTagDeltaSnapshot,
  InventoryDeltaSnapshot,
  InventoryDeltaSnapshotV3,
  InventorySnapshot,
} from '@/libs/inventory-storage';

const DB_NAME = 'inventory-state.db';
const CURRENT_SCHEMA_VERSION = 1;
const MIGRATION_KEY = 'file_snapshot_to_sqlite_v1';

let databasePromise: Promise<SQLiteDatabase> | null = null;
let hasLoggedBackend = false;
let cachedLastSnapshotSerialized: string | undefined;

type SqlPrimitive = string | number | null;

type InventoryDelta = InventoryDeltaSnapshotV3<unknown, unknown>['delta'];

type InventoryRows = {
  imported: boolean;
  delta: InventoryDelta;
  customCocktailTags?: Array<{ id: number; name: string; color: string }>;
  customIngredientTags?: Array<{ id: number; name: string; color: string }>;
  availableIngredientIds?: number[];
  shoppingIngredientIds?: number[];
  cocktailRatings?: Record<string, number>;
  cocktailComments?: Record<string, string>;
  partySelectedCocktailKeys?: string[];
  ignoreGarnish?: boolean;
  allowAllSubstitutes?: boolean;
  useImperialUnits?: boolean;
  keepScreenAwake?: boolean;
  shakerSmartFilteringEnabled?: boolean;
  showTabCounters?: boolean;
  ratingFilterThreshold?: number;
  startScreen?: string;
  appTheme?: string;
  appLocale?: string;
  amazonStoreOverride?: string | null;
  translationOverrides?: unknown;
  bars?: unknown;
  activeBarId?: string;
  onboardingStep?: number;
  onboardingCompleted?: boolean;
  onboardingStarterApplied?: boolean;
};

function toSqlBoolean(value: boolean | undefined): number | null {
  if (value === undefined) {
    return null;
  }
  return value ? 1 : 0;
}

function fromSqlBoolean(value: unknown, fallback = false): boolean {
  if (value === null || value === undefined) {
    return fallback;
  }
  return Number(value) === 1;
}

function parseJsonValue<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeArrayOfIds(values: unknown): number[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(
    new Set(
      values
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value >= 0)
        .map((value) => Math.trunc(value)),
    ),
  ).sort((a, b) => a - b);
}

async function getDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await openDatabaseAsync(DB_NAME);
      await db.execAsync('PRAGMA foreign_keys = ON;');
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync('PRAGMA synchronous = NORMAL;');
      await ensureSchema(db);
      return db;
    })();
  }

  return databasePromise;
}

async function runInTransaction(db: SQLiteDatabase, task: () => Promise<void>): Promise<void> {
  await db.execAsync('BEGIN IMMEDIATE TRANSACTION;');
  let committed = false;
  try {
    await task();
    await db.execAsync('COMMIT;');
    committed = true;
  } finally {
    if (!committed) {
      try {
        await db.execAsync('ROLLBACK;');
      } catch {
        // Ignore rollback failures because SQLite may already auto-close a failed transaction.
      }
    }
  }
}

async function ensureSchema(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bars (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS ingredient_state (
        ingredient_id INTEGER PRIMARY KEY NOT NULL,
        is_available INTEGER NOT NULL DEFAULT 0,
        is_in_shopping_list INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS cocktail_state (
        cocktail_id INTEGER PRIMARY KEY NOT NULL,
        rating REAL,
        comment TEXT,
        is_favorite INTEGER,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS custom_cocktail_tags (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        color TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS custom_ingredient_tags (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        color TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cocktail_tag_links (
        cocktail_key TEXT NOT NULL,
        tag_id INTEGER NOT NULL,
        source TEXT NOT NULL,
        tag_json TEXT,
        PRIMARY KEY (cocktail_key, tag_id)
      );

      CREATE TABLE IF NOT EXISTS custom_ingredients (
        id INTEGER PRIMARY KEY NOT NULL,
        payload_json TEXT NOT NULL,
        updated_at TEXT,
        deleted INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS custom_cocktails (
        id INTEGER PRIMARY KEY NOT NULL,
        payload_json TEXT NOT NULL,
        updated_at TEXT,
        deleted INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS ingredient_overrides (
        ingredient_id INTEGER PRIMARY KEY NOT NULL,
        payload_json TEXT NOT NULL,
        updated_at TEXT,
        deleted INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS cocktail_overrides (
        cocktail_id INTEGER PRIMARY KEY NOT NULL,
        payload_json TEXT NOT NULL,
        updated_at TEXT,
        deleted INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS catalog_meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_ingredient_state_available
        ON ingredient_state (is_available);
      CREATE INDEX IF NOT EXISTS idx_ingredient_state_shopping
        ON ingredient_state (is_in_shopping_list);
      CREATE INDEX IF NOT EXISTS idx_cocktail_state_rating
        ON cocktail_state (rating);
      CREATE INDEX IF NOT EXISTS idx_cocktail_tag_links_source
        ON cocktail_tag_links (source);
      CREATE INDEX IF NOT EXISTS idx_custom_cocktails_deleted
        ON custom_cocktails (deleted);
      CREATE INDEX IF NOT EXISTS idx_custom_ingredients_deleted
        ON custom_ingredients (deleted);
      CREATE INDEX IF NOT EXISTS idx_cocktail_overrides_deleted
        ON cocktail_overrides (deleted);
      CREATE INDEX IF NOT EXISTS idx_ingredient_overrides_deleted
        ON ingredient_overrides (deleted);
    `);

  await db.runAsync(
    'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)',
    ['schema_version', String(CURRENT_SCHEMA_VERSION)],
  );
}

async function readMetaValue(db: SQLiteDatabase, key: string): Promise<string | undefined> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', [key]);
  return row?.value;
}

async function writeMetaValue(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [key, value]);
}

async function writeAppSetting(db: SQLiteDatabase, key: string, value: SqlPrimitive): Promise<void> {
  if (value === undefined || value === null) {
    await db.runAsync('DELETE FROM app_settings WHERE key = ?', [key]);
    return;
  }

  await db.runAsync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', [key, String(value)]);
}

async function readAppSetting(db: SQLiteDatabase, key: string): Promise<string | undefined> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [key]);
  return row?.value;
}

function normalizeDelta(snapshot: InventorySnapshot<unknown, unknown>): InventoryDelta {
  if ('delta' in snapshot) {
    return (snapshot as InventoryDeltaSnapshot<unknown, unknown>).delta;
  }

  return {
    cocktails: { created: snapshot.cocktails },
    ingredients: { created: snapshot.ingredients },
  };
}

async function writeDeltaRows(db: SQLiteDatabase, delta: InventoryDelta): Promise<void> {
  const now = new Date().toISOString();

  const cocktails = delta.cocktails;
  const ingredients = delta.ingredients;

  if (cocktails) {
    for (const created of cocktails.created ?? []) {
      const id = Math.trunc(Number((created as { id?: number }).id ?? -1));
      if (id < 0) {
        continue;
      }
      await db.runAsync(
        'INSERT OR REPLACE INTO custom_cocktails (id, payload_json, updated_at, deleted) VALUES (?, ?, ?, 0)',
        [id, JSON.stringify(created), now],
      );
    }

    for (const updated of cocktails.updated ?? []) {
      const id = Math.trunc(Number((updated as { id?: number }).id ?? -1));
      if (id < 0) {
        continue;
      }
      await db.runAsync(
        'INSERT OR REPLACE INTO cocktail_overrides (cocktail_id, payload_json, updated_at, deleted) VALUES (?, ?, ?, 0)',
        [id, JSON.stringify(updated), now],
      );
    }

    for (const deletedId of cocktails.deletedIds ?? []) {
      const id = Math.trunc(Number(deletedId));
      if (id < 0) {
        continue;
      }
      await db.runAsync(
        'INSERT OR REPLACE INTO cocktail_overrides (cocktail_id, payload_json, updated_at, deleted) VALUES (?, ?, ?, 1)',
        [id, '{}', now],
      );
      await db.runAsync('DELETE FROM custom_cocktails WHERE id = ?', [id]);
    }
  }

  if (ingredients) {
    for (const created of ingredients.created ?? []) {
      const id = Math.trunc(Number((created as { id?: number }).id ?? -1));
      if (id < 0) {
        continue;
      }
      await db.runAsync(
        'INSERT OR REPLACE INTO custom_ingredients (id, payload_json, updated_at, deleted) VALUES (?, ?, ?, 0)',
        [id, JSON.stringify(created), now],
      );
    }

    for (const updated of ingredients.updated ?? []) {
      const id = Math.trunc(Number((updated as { id?: number }).id ?? -1));
      if (id < 0) {
        continue;
      }
      await db.runAsync(
        'INSERT OR REPLACE INTO ingredient_overrides (ingredient_id, payload_json, updated_at, deleted) VALUES (?, ?, ?, 0)',
        [id, JSON.stringify(updated), now],
      );
    }

    for (const deletedId of ingredients.deletedIds ?? []) {
      const id = Math.trunc(Number(deletedId));
      if (id < 0) {
        continue;
      }
      await db.runAsync(
        'INSERT OR REPLACE INTO ingredient_overrides (ingredient_id, payload_json, updated_at, deleted) VALUES (?, ?, ?, 1)',
        [id, '{}', now],
      );
      await db.runAsync('DELETE FROM custom_ingredients WHERE id = ?', [id]);
    }
  }
}

async function writeIngredientState(
  db: SQLiteDatabase,
  availableIngredientIds: number[],
  shoppingIngredientIds: number[],
): Promise<void> {
  await db.runAsync('DELETE FROM ingredient_state');
  const now = new Date().toISOString();
  const availableSet = new Set(availableIngredientIds);
  const shoppingSet = new Set(shoppingIngredientIds);
  const ids = Array.from(new Set([...availableSet, ...shoppingSet])).sort((a, b) => a - b);

  for (const ingredientId of ids) {
    await db.runAsync(
      `INSERT INTO ingredient_state (ingredient_id, is_available, is_in_shopping_list, updated_at)
       VALUES (?, ?, ?, ?)`,
      [ingredientId, availableSet.has(ingredientId) ? 1 : 0, shoppingSet.has(ingredientId) ? 1 : 0, now],
    );
  }
}

async function writeCocktailState(
  db: SQLiteDatabase,
  ratings: Record<string, number>,
  comments: Record<string, string>,
): Promise<void> {
  await db.runAsync('DELETE FROM cocktail_state');
  const now = new Date().toISOString();
  const ids = new Set<number>();

  Object.keys(ratings).forEach((key) => {
    const numeric = Math.trunc(Number(key));
    if (Number.isFinite(numeric) && numeric >= 0) {
      ids.add(numeric);
    }
  });

  Object.keys(comments).forEach((key) => {
    const numeric = Math.trunc(Number(key));
    if (Number.isFinite(numeric) && numeric >= 0) {
      ids.add(numeric);
    }
  });

  for (const cocktailId of Array.from(ids.values()).sort((a, b) => a - b)) {
    const rating = ratings[String(cocktailId)];
    const comment = comments[String(cocktailId)];
    await db.runAsync(
      `INSERT INTO cocktail_state (cocktail_id, rating, comment, updated_at)
       VALUES (?, ?, ?, ?)`,
      [
        cocktailId,
        Number.isFinite(Number(rating)) ? Number(rating) : null,
        typeof comment === 'string' && comment.trim() ? comment.trim() : null,
        now,
      ],
    );
  }
}

async function writeCustomTags(
  db: SQLiteDatabase,
  tableName: 'custom_cocktail_tags' | 'custom_ingredient_tags',
  tags: Array<{ id: number; name: string; color: string }>,
): Promise<void> {
  await db.runAsync(`DELETE FROM ${tableName}`);
  for (const tag of tags) {
    const id = Math.trunc(Number(tag.id ?? -1));
    if (id < 0 || !tag.name) {
      continue;
    }

    await db.runAsync(
      `INSERT INTO ${tableName} (id, name, color) VALUES (?, ?, ?)`,
      [id, tag.name, tag.color],
    );
  }
}

async function writeBars(db: SQLiteDatabase, bars: unknown): Promise<void> {
  await db.runAsync('DELETE FROM bars');
  if (!Array.isArray(bars)) {
    return;
  }

  const now = new Date().toISOString();
  for (const item of bars) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const casted = item as { id?: unknown; name?: unknown };
    const id = typeof casted.id === 'string' ? casted.id : '';
    const name = typeof casted.name === 'string' ? casted.name : '';
    if (!id || !name) {
      continue;
    }

    await db.runAsync(
      'INSERT INTO bars (id, name, payload_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [id, name, JSON.stringify(item), now, now],
    );
  }
}

async function readDeltaRows(db: SQLiteDatabase): Promise<InventoryDelta> {
  const cocktailsCreated = await db.getAllAsync<{ payload_json: string }>(
    'SELECT payload_json FROM custom_cocktails WHERE deleted = 0 ORDER BY id ASC',
  );
  const cocktailUpdatedRows = await db.getAllAsync<{ payload_json: string; cocktail_id: number; deleted: number }>(
    'SELECT cocktail_id, payload_json, deleted FROM cocktail_overrides ORDER BY cocktail_id ASC',
  );

  const ingredientsCreated = await db.getAllAsync<{ payload_json: string }>(
    'SELECT payload_json FROM custom_ingredients WHERE deleted = 0 ORDER BY id ASC',
  );
  const ingredientUpdatedRows = await db.getAllAsync<{ payload_json: string; ingredient_id: number; deleted: number }>(
    'SELECT ingredient_id, payload_json, deleted FROM ingredient_overrides ORDER BY ingredient_id ASC',
  );

  const cocktailUpdated: unknown[] = [];
  const cocktailDeletedIds: number[] = [];

  for (const row of cocktailUpdatedRows) {
    if (row.deleted === 1) {
      cocktailDeletedIds.push(row.cocktail_id);
      continue;
    }
    cocktailUpdated.push(parseJsonValue(row.payload_json, {}));
  }

  const ingredientUpdated: unknown[] = [];
  const ingredientDeletedIds: number[] = [];

  for (const row of ingredientUpdatedRows) {
    if (row.deleted === 1) {
      ingredientDeletedIds.push(row.ingredient_id);
      continue;
    }
    ingredientUpdated.push(parseJsonValue(row.payload_json, {}));
  }

  return {
    cocktails:
      cocktailsCreated.length > 0 || cocktailUpdated.length > 0 || cocktailDeletedIds.length > 0
        ? {
            created: cocktailsCreated.map((row) => parseJsonValue(row.payload_json, {})),
            updated: cocktailUpdated,
            deletedIds: cocktailDeletedIds,
          }
        : undefined,
    ingredients:
      ingredientsCreated.length > 0 || ingredientUpdated.length > 0 || ingredientDeletedIds.length > 0
        ? {
            created: ingredientsCreated.map((row) => parseJsonValue(row.payload_json, {})),
            updated: ingredientUpdated,
            deletedIds: ingredientDeletedIds,
          }
        : undefined,
  };
}

async function readInventoryRows(db: SQLiteDatabase): Promise<InventoryRows> {
  const imported = fromSqlBoolean(await readAppSetting(db, 'imported'), true);
  const availableRows = await db.getAllAsync<{ ingredient_id: number }>(
    'SELECT ingredient_id FROM ingredient_state WHERE is_available = 1 ORDER BY ingredient_id ASC',
  );
  const shoppingRows = await db.getAllAsync<{ ingredient_id: number }>(
    'SELECT ingredient_id FROM ingredient_state WHERE is_in_shopping_list = 1 ORDER BY ingredient_id ASC',
  );
  const cocktailStateRows = await db.getAllAsync<{ cocktail_id: number; rating: number | null; comment: string | null }>(
    'SELECT cocktail_id, rating, comment FROM cocktail_state ORDER BY cocktail_id ASC',
  );
  const cocktailTags = await db.getAllAsync<{ id: number; name: string; color: string }>(
    'SELECT id, name, color FROM custom_cocktail_tags ORDER BY id ASC',
  );
  const ingredientTags = await db.getAllAsync<{ id: number; name: string; color: string }>(
    'SELECT id, name, color FROM custom_ingredient_tags ORDER BY id ASC',
  );
  const barsRows = await db.getAllAsync<{ payload_json: string }>(
    'SELECT payload_json FROM bars ORDER BY id ASC',
  );
  const delta = await readDeltaRows(db);

  const ratings: Record<string, number> = {};
  const comments: Record<string, string> = {};
  for (const row of cocktailStateRows) {
    if (Number.isFinite(Number(row.rating)) && Number(row.rating) > 0) {
      ratings[String(row.cocktail_id)] = Number(row.rating);
    }

    const comment = row.comment?.trim();
    if (comment) {
      comments[String(row.cocktail_id)] = comment;
    }
  }

  return {
    imported,
    delta,
    customCocktailTags: cocktailTags,
    customIngredientTags: ingredientTags,
    availableIngredientIds: availableRows.map((row) => row.ingredient_id),
    shoppingIngredientIds: shoppingRows.map((row) => row.ingredient_id),
    cocktailRatings: ratings,
    cocktailComments: comments,
    partySelectedCocktailKeys: parseJsonValue(await readAppSetting(db, 'partySelectedCocktailKeys'), []),
    ignoreGarnish: fromSqlBoolean(await readAppSetting(db, 'ignoreGarnish'), true),
    allowAllSubstitutes: fromSqlBoolean(await readAppSetting(db, 'allowAllSubstitutes'), true),
    useImperialUnits: fromSqlBoolean(await readAppSetting(db, 'useImperialUnits'), false),
    keepScreenAwake: fromSqlBoolean(await readAppSetting(db, 'keepScreenAwake'), true),
    shakerSmartFilteringEnabled: fromSqlBoolean(await readAppSetting(db, 'shakerSmartFilteringEnabled'), false),
    showTabCounters: fromSqlBoolean(await readAppSetting(db, 'showTabCounters'), false),
    ratingFilterThreshold: Number(await readAppSetting(db, 'ratingFilterThreshold') ?? 1),
    startScreen: await readAppSetting(db, 'startScreen'),
    appTheme: await readAppSetting(db, 'appTheme'),
    appLocale: await readAppSetting(db, 'appLocale'),
    amazonStoreOverride: (await readAppSetting(db, 'amazonStoreOverride')) ?? null,
    translationOverrides: parseJsonValue(await readAppSetting(db, 'translationOverrides'), {}),
    bars: barsRows.map((row) => parseJsonValue(row.payload_json, {})).filter(Boolean),
    activeBarId: (await readAppSetting(db, 'activeBarId')) ?? '',
    onboardingStep: Number(await readAppSetting(db, 'onboardingStep') ?? 1),
    onboardingCompleted: fromSqlBoolean(await readAppSetting(db, 'onboardingCompleted'), false),
    onboardingStarterApplied: fromSqlBoolean(await readAppSetting(db, 'onboardingStarterApplied'), false),
  };
}

function buildSnapshotFromRows<TCocktail, TIngredient>(rows: InventoryRows): InventoryDeltaSnapshotV3<TCocktail, TIngredient> {
  return {
    version: 3,
    delta: rows.delta as InventoryDeltaSnapshot<TCocktail, TIngredient>['delta'],
    imported: rows.imported,
    customCocktailTags: rows.customCocktailTags,
    customIngredientTags: rows.customIngredientTags,
    availableIngredientIds: rows.availableIngredientIds,
    shoppingIngredientIds: rows.shoppingIngredientIds,
    cocktailRatings: rows.cocktailRatings,
    cocktailComments: rows.cocktailComments,
    partySelectedCocktailKeys: rows.partySelectedCocktailKeys,
    ignoreGarnish: rows.ignoreGarnish,
    allowAllSubstitutes: rows.allowAllSubstitutes,
    useImperialUnits: rows.useImperialUnits,
    keepScreenAwake: rows.keepScreenAwake,
    shakerSmartFilteringEnabled: rows.shakerSmartFilteringEnabled,
    showTabCounters: rows.showTabCounters,
    ratingFilterThreshold: rows.ratingFilterThreshold,
    startScreen: rows.startScreen,
    appTheme: rows.appTheme,
    appLocale: rows.appLocale,
    amazonStoreOverride: rows.amazonStoreOverride,
    translationOverrides: rows.translationOverrides,
    bars: rows.bars as InventoryDeltaSnapshotV3<TCocktail, TIngredient>['bars'],
    activeBarId: rows.activeBarId,
    onboardingStep: rows.onboardingStep,
    onboardingCompleted: rows.onboardingCompleted,
    onboardingStarterApplied: rows.onboardingStarterApplied,
  };
}

async function saveSnapshotInternal<TCocktail, TIngredient>(
  db: SQLiteDatabase,
  snapshot: InventorySnapshot<TCocktail, TIngredient>,
): Promise<void> {
  const normalizedDelta = normalizeDelta(snapshot as InventorySnapshot<unknown, unknown>);
  const serialized = JSON.stringify(snapshot);
  if (cachedLastSnapshotSerialized && cachedLastSnapshotSerialized === serialized) {
    return;
  }

  await runInTransaction(db, async () => {
    await writeDeltaRows(db, normalizedDelta);

    const availableIngredientIds = normalizeArrayOfIds((snapshot as InventoryDeltaSnapshotV3<unknown, unknown>).availableIngredientIds);
    const shoppingIngredientIds = normalizeArrayOfIds((snapshot as InventoryDeltaSnapshotV3<unknown, unknown>).shoppingIngredientIds);

    await writeIngredientState(db, availableIngredientIds, shoppingIngredientIds);
    await writeCocktailState(
      db,
      ((snapshot as InventoryDeltaSnapshotV3<unknown, unknown>).cocktailRatings ?? {}) as Record<string, number>,
      ((snapshot as InventoryDeltaSnapshotV3<unknown, unknown>).cocktailComments ?? {}) as Record<string, string>,
    );

    await writeCustomTags(
      db,
      'custom_cocktail_tags',
      (((snapshot as InventoryDeltaSnapshotV3<unknown, unknown>).customCocktailTags ?? []) as Array<{ id: number; name: string; color: string }>),
    );
    await writeCustomTags(
      db,
      'custom_ingredient_tags',
      (((snapshot as InventoryDeltaSnapshotV3<unknown, unknown>).customIngredientTags ?? []) as Array<{ id: number; name: string; color: string }>),
    );

    await writeBars(db, (snapshot as InventoryDeltaSnapshotV3<unknown, unknown>).bars ?? []);

    await writeAppSetting(db, 'imported', toSqlBoolean(Boolean((snapshot as { imported?: boolean }).imported)));
    await writeAppSetting(db, 'partySelectedCocktailKeys', JSON.stringify((snapshot as InventoryDeltaSnapshotV3<unknown, unknown>).partySelectedCocktailKeys ?? []));
    await writeAppSetting(db, 'ignoreGarnish', toSqlBoolean((snapshot as InventoryDeltaSnapshotV3<unknown, unknown>).ignoreGarnish));
    await writeAppSetting(db, 'allowAllSubstitutes', toSqlBoolean((snapshot as InventoryDeltaSnapshotV3<unknown, unknown>).allowAllSubstitutes));
    await writeAppSetting(db, 'useImperialUnits', toSqlBoolean((snapshot as InventoryDeltaSnapshotV3<unknown, unknown>).useImperialUnits));
    await writeAppSetting(db, 'keepScreenAwake', toSqlBoolean((snapshot as InventoryDeltaSnapshotV3<unknown, unknown>).keepScreenAwake));
    await writeAppSetting(db, 'shakerSmartFilteringEnabled', toSqlBoolean((snapshot as InventoryDeltaSnapshotV3<unknown, unknown>).shakerSmartFilteringEnabled));
    await writeAppSetting(db, 'showTabCounters', toSqlBoolean((snapshot as InventoryDeltaSnapshotV3<unknown, unknown>).showTabCounters));
    await writeAppSetting(db, 'ratingFilterThreshold', (snapshot as InventoryDeltaSnapshotV3<unknown, unknown>).ratingFilterThreshold ?? 1);
    await writeAppSetting(db, 'startScreen', (snapshot as InventoryDeltaSnapshotV3<unknown, unknown>).startScreen ?? null);
    await writeAppSetting(db, 'appTheme', (snapshot as InventoryDeltaSnapshotV3<unknown, unknown>).appTheme ?? null);
    await writeAppSetting(db, 'appLocale', (snapshot as InventoryDeltaSnapshotV3<unknown, unknown>).appLocale ?? null);
    await writeAppSetting(db, 'amazonStoreOverride', (snapshot as InventoryDeltaSnapshotV3<unknown, unknown>).amazonStoreOverride ?? null);
    await writeAppSetting(db, 'translationOverrides', JSON.stringify((snapshot as InventoryDeltaSnapshotV3<unknown, unknown>).translationOverrides ?? {}));
    await writeAppSetting(db, 'activeBarId', (snapshot as InventoryDeltaSnapshotV3<unknown, unknown>).activeBarId ?? null);
    await writeAppSetting(db, 'onboardingStep', (snapshot as InventoryDeltaSnapshotV3<unknown, unknown>).onboardingStep ?? 1);
    await writeAppSetting(db, 'onboardingCompleted', toSqlBoolean((snapshot as InventoryDeltaSnapshotV3<unknown, unknown>).onboardingCompleted));
    await writeAppSetting(db, 'onboardingStarterApplied', toSqlBoolean((snapshot as InventoryDeltaSnapshotV3<unknown, unknown>).onboardingStarterApplied));
  });

  cachedLastSnapshotSerialized = serialized;
}

export async function isSQLiteInventoryEmpty(): Promise<boolean> {
  const db = await getDatabase();
  const rows = await db.getFirstAsync<{ count: number }>('SELECT COUNT(1) as count FROM app_settings');
  return Number(rows?.count ?? 0) === 0;
}

export async function hasCompletedSQLiteMigration(): Promise<boolean> {
  const db = await getDatabase();
  return (await readMetaValue(db, MIGRATION_KEY)) === '1';
}

export async function markSQLiteMigrationComplete(): Promise<void> {
  const db = await getDatabase();
  await writeMetaValue(db, MIGRATION_KEY, '1');
}

export async function loadInventorySnapshotFromSQLite<TCocktail, TIngredient>(): Promise<
  InventorySnapshot<TCocktail, TIngredient> | undefined
> {
  const db = await getDatabase();
  if (!hasLoggedBackend) {
    console.info('[inventory-storage] using sqlite backend');
    hasLoggedBackend = true;
  }

  const empty = await isSQLiteInventoryEmpty();
  if (empty) {
    return undefined;
  }

  const rows = await readInventoryRows(db);
  const snapshot = buildSnapshotFromRows<TCocktail, TIngredient>(rows);
  cachedLastSnapshotSerialized = JSON.stringify(snapshot);
  return snapshot;
}

export async function persistInventorySnapshotToSQLite<TCocktail, TIngredient>(
  snapshot: InventorySnapshot<TCocktail, TIngredient>,
): Promise<void> {
  const db = await getDatabase();
  if (!hasLoggedBackend) {
    console.info('[inventory-storage] using sqlite backend');
    hasLoggedBackend = true;
  }

  await saveSnapshotInternal(db, snapshot);
}

export async function loadCocktailTagDeltaSnapshotFromSQLite(): Promise<CocktailTagDeltaSnapshot> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ cocktail_key: string; tag_id: number; tag_json: string | null }>(
    `SELECT cocktail_key, tag_id, tag_json
     FROM cocktail_tag_links
     WHERE source = 'custom'
     ORDER BY cocktail_key ASC, tag_id ASC`,
  );

  const grouped: CocktailTagDeltaSnapshot = {};

  for (const row of rows) {
    const existing = grouped[row.cocktail_key] ?? [];
    const parsed = parseJsonValue<{ id?: number; name?: string; color?: string } | null>(row.tag_json, null);
    grouped[row.cocktail_key] = [
      ...existing,
      {
        id: row.tag_id,
        name: parsed?.name,
        color: parsed?.color,
      },
    ];
  }

  return grouped;
}

export async function persistCocktailTagDeltaSnapshotToSQLite(
  snapshot: CocktailTagDeltaSnapshot,
): Promise<void> {
  const db = await getDatabase();

  await runInTransaction(db, async () => {
    await db.runAsync("DELETE FROM cocktail_tag_links WHERE source = 'custom'");

    for (const [cocktailKey, tags] of Object.entries(snapshot)) {
      if (!Array.isArray(tags) || tags.length === 0) {
        continue;
      }

      for (const tag of tags) {
        const tagId = Math.trunc(Number(tag.id ?? -1));
        if (tagId < 0) {
          continue;
        }

        await db.runAsync(
          `INSERT OR REPLACE INTO cocktail_tag_links (cocktail_key, tag_id, source, tag_json)
           VALUES (?, ?, 'custom', ?)`,
          [cocktailKey, tagId, JSON.stringify({ name: tag.name, color: tag.color })],
        );
      }
    }
  });
}

export async function migrateLegacySnapshotToSQLite<TCocktail, TIngredient>(
  snapshot: InventorySnapshot<TCocktail, TIngredient>,
): Promise<void> {
  const db = await getDatabase();
  await saveSnapshotInternal(db, snapshot);
  await writeMetaValue(db, MIGRATION_KEY, '1');
}
