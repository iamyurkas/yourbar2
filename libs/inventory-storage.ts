import * as FileSystem from 'expo-file-system/legacy';
import type { Bar } from '@/providers/inventory-types';

const STORAGE_FILENAME = 'inventory-state.json';
const SQLITE_DB_NAME = 'inventory-state.db';
const SQLITE_MIGRATION_FLAG = 'json_migration_completed';
let hasLoggedDocumentDirectoryWarning = false;
let hasLoggedCacheDirectoryWarning = false;

export const USE_SQLITE_STORAGE = (() => {
  const flag = process.env.EXPO_PUBLIC_USE_SQLITE_STORAGE?.trim().toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'yes' || flag === 'on';
})();

export type InventorySnapshotV1<TCocktail, TIngredient> = {
  version: 1;
  cocktails: TCocktail[];
  ingredients: TIngredient[];
  imported?: boolean;
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
  onboardingStep?: number;
  onboardingCompleted?: boolean;
  onboardingStarterApplied?: boolean;
};

export type InventoryDeltaSnapshot<TCocktail, TIngredient> = {
  version: 2;
  delta: {
    cocktails?: {
      created?: TCocktail[];
      updated?: TCocktail[];
      deletedIds?: number[];
    };
    ingredients?: {
      created?: TIngredient[];
      updated?: TIngredient[];
      deletedIds?: number[];
    };
  };
  imported?: boolean;
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
  onboardingStep?: number;
  onboardingCompleted?: boolean;
  onboardingStarterApplied?: boolean;
};


export type InventoryDeltaSnapshotV3<TCocktail, TIngredient> = {
  version: 3;
  delta: {
    cocktails?: {
      created?: TCocktail[];
      updated?: TCocktail[];
      deletedIds?: number[];
    };
    ingredients?: {
      created?: TIngredient[];
      updated?: TIngredient[];
      deletedIds?: number[];
    };
  };
  imported?: boolean;
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
  onboardingStep?: number;
  onboardingCompleted?: boolean;
  onboardingStarterApplied?: boolean;
  translationOverrides?: unknown;
  bars?: Bar[];
  activeBarId?: string;
};

export type InventorySnapshot<TCocktail, TIngredient> =
  | InventorySnapshotV1<TCocktail, TIngredient>
  | InventoryDeltaSnapshot<TCocktail, TIngredient>
  | InventoryDeltaSnapshotV3<TCocktail, TIngredient>;

export type InventoryStorageAdapter<TCocktail, TIngredient> = {
  loadState: () => Promise<InventorySnapshot<TCocktail, TIngredient> | undefined>;
  persistStateDelta: (snapshot: InventoryDeltaSnapshotV3<TCocktail, TIngredient>) => Promise<void>;
  replaceState: (snapshot: InventorySnapshot<TCocktail, TIngredient>) => Promise<void>;
  clearState: () => Promise<void>;
  exportSnapshot: () => Promise<InventorySnapshot<TCocktail, TIngredient> | undefined>;
  importSnapshot: (snapshot: InventorySnapshot<TCocktail, TIngredient>) => Promise<void>;
};

function joinDirectoryPath(directory: string | null | undefined, filename: string): string | undefined {
  if (!directory) {
    return undefined;
  }

  return `${directory.replace(/\/?$/, '/')}${filename}`;
}

function resolveStoragePath(): string | undefined {
  try {
    const documentPath = joinDirectoryPath(FileSystem.documentDirectory, STORAGE_FILENAME);
    if (documentPath) {
      return documentPath;
    }
  } catch (error) {
    console.warn('Unable to access document directory for inventory snapshot', error);
    hasLoggedDocumentDirectoryWarning = true;
  }

  if (!FileSystem.documentDirectory && !hasLoggedDocumentDirectoryWarning) {
    console.warn('Unable to access document directory for inventory snapshot');
    hasLoggedDocumentDirectoryWarning = true;
  }

  try {
    const cachePath = joinDirectoryPath(FileSystem.cacheDirectory, STORAGE_FILENAME);
    if (cachePath) {
      return cachePath;
    }
  } catch (error) {
    console.warn('Unable to access cache directory for inventory snapshot', error);
    hasLoggedCacheDirectoryWarning = true;
  }

  if (!FileSystem.cacheDirectory && !hasLoggedCacheDirectoryWarning) {
    console.warn('Unable to access cache directory for inventory snapshot');
    hasLoggedCacheDirectoryWarning = true;
  }

  return undefined;
}

async function loadJsonInventorySnapshot<TCocktail, TIngredient>(): Promise<
  InventorySnapshot<TCocktail, TIngredient> | undefined
> {
  const storagePath = resolveStoragePath();

  if (!storagePath) {
    return undefined;
  }

  try {
    const info = await FileSystem.getInfoAsync(storagePath);
    if (!info.exists) {
      return undefined;
    }

    const contents = await FileSystem.readAsStringAsync(storagePath);

    if (!contents) {
      return undefined;
    }

    return JSON.parse(contents) as InventorySnapshot<TCocktail, TIngredient>;
  } catch (error) {
    console.warn('Unable to load inventory snapshot', error);
    return undefined;
  }
}

async function persistJsonInventorySnapshot<TCocktail, TIngredient>(
  snapshot: InventorySnapshot<TCocktail, TIngredient>,
): Promise<void> {
  const storagePath = resolveStoragePath();

  if (!storagePath) {
    return;
  }

  try {
    await FileSystem.writeAsStringAsync(storagePath, JSON.stringify(snapshot));
  } catch (error) {
    console.error('Unable to persist inventory snapshot', error);
    throw error;
  }
}

function normalizeLegacySnapshot<TCocktail, TIngredient>(
  snapshot: InventorySnapshot<TCocktail, TIngredient>,
): InventoryDeltaSnapshotV3<TCocktail, TIngredient> {
  if (snapshot.version === 3) {
    return snapshot;
  }

  if (snapshot.version === 2) {
    return {
      ...snapshot,
      version: 3,
    };
  }

  return {
    version: 3,
    delta: {
      cocktails: snapshot.cocktails.length > 0 ? { updated: snapshot.cocktails } : undefined,
      ingredients: snapshot.ingredients.length > 0 ? { updated: snapshot.ingredients } : undefined,
    },
    imported: snapshot.imported,
    availableIngredientIds: snapshot.availableIngredientIds,
    shoppingIngredientIds: snapshot.shoppingIngredientIds,
    cocktailRatings: snapshot.cocktailRatings,
    cocktailComments: snapshot.cocktailComments,
    partySelectedCocktailKeys: snapshot.partySelectedCocktailKeys,
    ignoreGarnish: snapshot.ignoreGarnish,
    allowAllSubstitutes: snapshot.allowAllSubstitutes,
    useImperialUnits: snapshot.useImperialUnits,
    keepScreenAwake: snapshot.keepScreenAwake,
    shakerSmartFilteringEnabled: snapshot.shakerSmartFilteringEnabled,
    showTabCounters: snapshot.showTabCounters,
    ratingFilterThreshold: snapshot.ratingFilterThreshold,
    startScreen: snapshot.startScreen,
    appTheme: snapshot.appTheme,
    appLocale: snapshot.appLocale,
    amazonStoreOverride: snapshot.amazonStoreOverride,
    onboardingStep: snapshot.onboardingStep,
    onboardingCompleted: snapshot.onboardingCompleted,
    onboardingStarterApplied: snapshot.onboardingStarterApplied,
  };
}

function sanitizeStringList(values?: unknown): string[] | undefined {
  if (!Array.isArray(values)) {
    return undefined;
  }

  const normalized = values
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);

  if (normalized.length === 0) {
    return undefined;
  }

  return Array.from(new Set(normalized));
}

function sanitizeNumberList(values?: unknown): number[] | undefined {
  if (!Array.isArray(values)) {
    return undefined;
  }

  const normalized = values
    .filter((value) => value !== null && value !== undefined && `${value}`.trim() !== '')
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.trunc(value));

  if (normalized.length === 0) {
    return undefined;
  }

  return Array.from(new Set(normalized)).sort((a, b) => a - b);
}

type SQLiteDatabaseLike = {
  execAsync: (source: string) => Promise<void>;
  runAsync: (source: string, ...params: unknown[]) => Promise<{ changes: number; lastInsertRowId: number }>;
  getFirstAsync: <T>(source: string, ...params: unknown[]) => Promise<T | null>;
  getAllAsync: <T>(source: string, ...params: unknown[]) => Promise<T[]>;
};

let sqliteDbPromise: Promise<SQLiteDatabaseLike> | undefined;

function resolveSQLiteModule(): { openDatabaseAsync: (name: string) => Promise<SQLiteDatabaseLike> } {
  try {
    return require('expo-sqlite') as { openDatabaseAsync: (name: string) => Promise<SQLiteDatabaseLike> };
  } catch (error) {
    throw new Error(`expo-sqlite is required when USE_SQLITE_STORAGE is enabled: ${String(error)}`);
  }
}

async function getSQLiteDatabase(): Promise<SQLiteDatabaseLike> {
  if (!sqliteDbPromise) {
    sqliteDbPromise = (async () => {
      const sqlite = resolveSQLiteModule();
      const db = await sqlite.openDatabaseAsync(SQLITE_DB_NAME);
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync('PRAGMA foreign_keys = ON;');
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS cocktails (
          id INTEGER PRIMARY KEY,
          op TEXT NOT NULL CHECK (op IN ('created','updated')),
          payload TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS ingredients (
          id INTEGER PRIMARY KEY,
          op TEXT NOT NULL CHECK (op IN ('created','updated')),
          payload TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS deleted_cocktails (
          id INTEGER PRIMARY KEY
        );
        CREATE TABLE IF NOT EXISTS deleted_ingredients (
          id INTEGER PRIMARY KEY
        );
        CREATE TABLE IF NOT EXISTS custom_tags (
          type TEXT NOT NULL,
          id INTEGER NOT NULL,
          name TEXT NOT NULL,
          color TEXT NOT NULL,
          PRIMARY KEY (type, id)
        );
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        );
        CREATE TABLE IF NOT EXISTS bars (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS bar_state (
          bar_id TEXT NOT NULL,
          ingredient_id INTEGER NOT NULL,
          state TEXT NOT NULL CHECK (state IN ('available','shopping')),
          PRIMARY KEY (bar_id, ingredient_id, state),
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
          payload TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_cocktails_op ON cocktails(op);
        CREATE INDEX IF NOT EXISTS idx_ingredients_op ON ingredients(op);
        CREATE INDEX IF NOT EXISTS idx_bar_state_state ON bar_state(state);
        CREATE INDEX IF NOT EXISTS idx_bar_state_bar_state ON bar_state(bar_id, state);
        CREATE INDEX IF NOT EXISTS idx_party_selection_key ON party_selection(cocktail_key);
      `);
      return db;
    })();
  }

  return sqliteDbPromise;
}

async function withTransaction(db: SQLiteDatabaseLike, callback: () => Promise<void>): Promise<void> {
  await db.execAsync('BEGIN IMMEDIATE TRANSACTION;');
  try {
    await callback();
    await db.execAsync('COMMIT;');
  } catch (error) {
    await db.execAsync('ROLLBACK;');
    throw error;
  }
}

type PersistMetadataPayload = Omit<InventoryDeltaSnapshotV3<unknown, unknown>, 'version' | 'delta'>;

async function persistMetadata(
  db: SQLiteDatabaseLike,
  metadata: PersistMetadataPayload,
): Promise<void> {
  const setSetting = async (key: string, value: unknown) => {
    await db.runAsync(
      'INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;',
      key,
      JSON.stringify(value),
    );
  };

  await setSetting('imported', Boolean(metadata.imported));
  await setSetting('ignoreGarnish', metadata.ignoreGarnish ?? true);
  await setSetting('allowAllSubstitutes', metadata.allowAllSubstitutes ?? true);
  await setSetting('useImperialUnits', metadata.useImperialUnits ?? false);
  await setSetting('keepScreenAwake', metadata.keepScreenAwake ?? true);
  await setSetting('shakerSmartFilteringEnabled', metadata.shakerSmartFilteringEnabled ?? false);
  await setSetting('showTabCounters', metadata.showTabCounters ?? false);
  await setSetting('ratingFilterThreshold', metadata.ratingFilterThreshold ?? 1);
  await setSetting('startScreen', metadata.startScreen ?? null);
  await setSetting('appTheme', metadata.appTheme ?? null);
  await setSetting('appLocale', metadata.appLocale ?? null);
  await setSetting('amazonStoreOverride', metadata.amazonStoreOverride ?? null);
  await setSetting('onboardingStep', metadata.onboardingStep ?? 1);
  await setSetting('onboardingCompleted', metadata.onboardingCompleted ?? false);
  await setSetting('onboardingStarterApplied', metadata.onboardingStarterApplied ?? false);
  await setSetting('activeBarId', metadata.activeBarId ?? '');
  await setSetting('availableIngredientIds', sanitizeNumberList(metadata.availableIngredientIds) ?? []);
  await setSetting('shoppingIngredientIds', sanitizeNumberList(metadata.shoppingIngredientIds) ?? []);

  await db.runAsync('DELETE FROM custom_tags WHERE type IN (?, ?);', 'cocktail', 'ingredient');
  for (const tag of metadata.customCocktailTags ?? []) {
    await db.runAsync(
      'INSERT INTO custom_tags(type, id, name, color) VALUES (?, ?, ?, ?);',
      'cocktail',
      Number(tag.id),
      tag.name,
      tag.color,
    );
  }
  for (const tag of metadata.customIngredientTags ?? []) {
    await db.runAsync(
      'INSERT INTO custom_tags(type, id, name, color) VALUES (?, ?, ?, ?);',
      'ingredient',
      Number(tag.id),
      tag.name,
      tag.color,
    );
  }

  await db.runAsync('DELETE FROM bars;');
  await db.runAsync('DELETE FROM bar_state;');
  for (const bar of metadata.bars ?? []) {
    await db.runAsync('INSERT INTO bars(id, name) VALUES(?, ?);', bar.id, bar.name);

    const availableIds = sanitizeNumberList(bar.availableIngredientIds) ?? [];
    for (const ingredientId of availableIds) {
      await db.runAsync(
        'INSERT INTO bar_state(bar_id, ingredient_id, state) VALUES (?, ?, ?);',
        bar.id,
        ingredientId,
        'available',
      );
    }

    const shoppingIds = sanitizeNumberList(bar.shoppingIngredientIds) ?? [];
    for (const ingredientId of shoppingIds) {
      await db.runAsync(
        'INSERT INTO bar_state(bar_id, ingredient_id, state) VALUES (?, ?, ?);',
        bar.id,
        ingredientId,
        'shopping',
      );
    }
  }

  await db.runAsync('DELETE FROM feedback;');
  const ratings = metadata.cocktailRatings ?? {};
  const comments = metadata.cocktailComments ?? {};
  const keys = new Set([...Object.keys(ratings), ...Object.keys(comments)]);
  for (const key of keys) {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      continue;
    }

    await db.runAsync(
      'INSERT INTO feedback(cocktail_key, rating, comment) VALUES (?, ?, ?);',
      normalizedKey,
      ratings[normalizedKey] ?? null,
      comments[normalizedKey] ?? null,
    );
  }

  await db.runAsync('DELETE FROM party_selection;');
  for (const key of sanitizeStringList(metadata.partySelectedCocktailKeys) ?? []) {
    await db.runAsync('INSERT INTO party_selection(cocktail_key) VALUES (?);', key);
  }

  await db.runAsync('DELETE FROM translation_overrides;');
  if (metadata.translationOverrides && typeof metadata.translationOverrides === 'object') {
    for (const [locale, payload] of Object.entries(metadata.translationOverrides as Record<string, unknown>)) {
      await db.runAsync(
        'INSERT INTO translation_overrides(locale, payload) VALUES (?, ?);',
        locale,
        JSON.stringify(payload),
      );
    }
  }
}

async function applyEntityDelta<TRecord>(
  db: SQLiteDatabaseLike,
  table: 'cocktails' | 'ingredients',
  deletedTable: 'deleted_cocktails' | 'deleted_ingredients',
  delta?: { created?: TRecord[]; updated?: TRecord[]; deletedIds?: number[] },
): Promise<void> {
  if (!delta) {
    return;
  }

  const upsert = async (op: 'created' | 'updated', rows?: TRecord[]) => {
    if (!rows || rows.length === 0) {
      return;
    }

    const timestamp = Date.now();
    for (const row of rows) {
      const id = Number((row as { id?: number }).id ?? -1);
      if (!Number.isFinite(id) || id < 0) {
        continue;
      }
      const normalizedId = Math.trunc(id);
      await db.runAsync(`DELETE FROM ${deletedTable} WHERE id = ?;`, normalizedId);
      await db.runAsync(
        `INSERT INTO ${table}(id, op, payload, updated_at) VALUES(?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET op = excluded.op, payload = excluded.payload, updated_at = excluded.updated_at;`,
        normalizedId,
        op,
        JSON.stringify(row),
        timestamp,
      );
    }
  };

  const deleteIds = sanitizeNumberList(delta.deletedIds) ?? [];
  for (const id of deleteIds) {
    await db.runAsync(`DELETE FROM ${table} WHERE id = ?;`, id);
    await db.runAsync(`INSERT INTO ${deletedTable}(id) VALUES (?) ON CONFLICT(id) DO NOTHING;`, id);
  }

  await upsert('created', delta.created);
  await upsert('updated', delta.updated);
}

async function loadV3SnapshotFromSQLite<TCocktail, TIngredient>(
  db: SQLiteDatabaseLike,
): Promise<InventoryDeltaSnapshotV3<TCocktail, TIngredient> | undefined> {
  const cocktails = await db.getAllAsync<{ id: number; op: 'created' | 'updated'; payload: string }>(
    'SELECT id, op, payload FROM cocktails ORDER BY id ASC;',
  );
  const ingredients = await db.getAllAsync<{ id: number; op: 'created' | 'updated'; payload: string }>(
    'SELECT id, op, payload FROM ingredients ORDER BY id ASC;',
  );
  const deletedCocktailIds = await db.getAllAsync<{ id: number }>('SELECT id FROM deleted_cocktails ORDER BY id ASC;');
  const deletedIngredientIds = await db.getAllAsync<{ id: number }>('SELECT id FROM deleted_ingredients ORDER BY id ASC;');

  const hasDelta =
    cocktails.length > 0 ||
    ingredients.length > 0 ||
    deletedCocktailIds.length > 0 ||
    deletedIngredientIds.length > 0;

  const settingsRows = await db.getAllAsync<{ key: string; value: string | null }>('SELECT key, value FROM settings;');

  if (!hasDelta && settingsRows.length === 0) {
    return undefined;
  }

  const settings = new Map<string, unknown>();
  settingsRows.forEach(({ key, value }) => {
    if (!key) {
      return;
    }

    try {
      settings.set(key, value != null ? JSON.parse(value) : null);
    } catch {
      settings.set(key, value);
    }
  });

  const cocktailCreated: TCocktail[] = [];
  const cocktailUpdated: TCocktail[] = [];
  cocktails.forEach((row) => {
    try {
      const parsed = JSON.parse(row.payload) as TCocktail;
      if (row.op === 'created') {
        cocktailCreated.push(parsed);
      } else {
        cocktailUpdated.push(parsed);
      }
    } catch {
      // ignore invalid rows
    }
  });

  const ingredientCreated: TIngredient[] = [];
  const ingredientUpdated: TIngredient[] = [];
  ingredients.forEach((row) => {
    try {
      const parsed = JSON.parse(row.payload) as TIngredient;
      if (row.op === 'created') {
        ingredientCreated.push(parsed);
      } else {
        ingredientUpdated.push(parsed);
      }
    } catch {
      // ignore invalid rows
    }
  });

  const customTags = await db.getAllAsync<{ type: 'cocktail' | 'ingredient'; id: number; name: string; color: string }>(
    'SELECT type, id, name, color FROM custom_tags ORDER BY id ASC;',
  );
  const bars = await db.getAllAsync<{ id: string; name: string }>('SELECT id, name FROM bars ORDER BY id ASC;');
  const barState = await db.getAllAsync<{ bar_id: string; ingredient_id: number; state: 'available' | 'shopping' }>(
    'SELECT bar_id, ingredient_id, state FROM bar_state;',
  );
  const feedback = await db.getAllAsync<{ cocktail_key: string; rating: number | null; comment: string | null }>(
    'SELECT cocktail_key, rating, comment FROM feedback;',
  );
  const partySelection = await db.getAllAsync<{ cocktail_key: string }>('SELECT cocktail_key FROM party_selection;');
  const translationRows = await db.getAllAsync<{ locale: string; payload: string }>('SELECT locale, payload FROM translation_overrides;');

  const barsWithState: Bar[] = bars.map((bar) => {
    const availableIngredientIds = barState
      .filter((entry) => entry.bar_id === bar.id && entry.state === 'available')
      .map((entry) => Math.trunc(Number(entry.ingredient_id)))
      .filter((entry) => Number.isFinite(entry));
    const shoppingIngredientIds = barState
      .filter((entry) => entry.bar_id === bar.id && entry.state === 'shopping')
      .map((entry) => Math.trunc(Number(entry.ingredient_id)))
      .filter((entry) => Number.isFinite(entry));

    return {
      id: bar.id,
      name: bar.name,
      availableIngredientIds: Array.from(new Set(availableIngredientIds)).sort((a, b) => a - b),
      shoppingIngredientIds: Array.from(new Set(shoppingIngredientIds)).sort((a, b) => a - b),
    } satisfies Bar;
  });

  const ratings: Record<string, number> = {};
  const comments: Record<string, string> = {};
  feedback.forEach((entry) => {
    const key = entry.cocktail_key.trim();
    if (!key) {
      return;
    }

    if (entry.rating != null && Number.isFinite(entry.rating)) {
      ratings[key] = Math.round(entry.rating);
    }
    if (entry.comment != null && entry.comment.trim()) {
      comments[key] = entry.comment.trim();
    }
  });

  const translationOverrides: Record<string, unknown> = {};
  translationRows.forEach((row) => {
    if (!row.locale) {
      return;
    }
    try {
      translationOverrides[row.locale] = JSON.parse(row.payload);
    } catch {
      translationOverrides[row.locale] = row.payload;
    }
  });

  return {
    version: 3,
    delta: {
      cocktails:
        cocktailCreated.length > 0 || cocktailUpdated.length > 0 || deletedCocktailIds.length > 0
          ? {
              created: cocktailCreated.length > 0 ? cocktailCreated : undefined,
              updated: cocktailUpdated.length > 0 ? cocktailUpdated : undefined,
              deletedIds: deletedCocktailIds.length > 0 ? deletedCocktailIds.map((item) => item.id) : undefined,
            }
          : undefined,
      ingredients:
        ingredientCreated.length > 0 || ingredientUpdated.length > 0 || deletedIngredientIds.length > 0
          ? {
              created: ingredientCreated.length > 0 ? ingredientCreated : undefined,
              updated: ingredientUpdated.length > 0 ? ingredientUpdated : undefined,
              deletedIds: deletedIngredientIds.length > 0 ? deletedIngredientIds.map((item) => item.id) : undefined,
            }
          : undefined,
    },
    imported: Boolean(settings.get('imported')),
    customCocktailTags: customTags.filter((tag) => tag.type === 'cocktail'),
    customIngredientTags: customTags.filter((tag) => tag.type === 'ingredient'),
    availableIngredientIds: sanitizeNumberList(settings.get('availableIngredientIds')) ?? sanitizeNumberList(barsWithState[0]?.availableIngredientIds),
    shoppingIngredientIds: sanitizeNumberList(settings.get('shoppingIngredientIds')) ?? sanitizeNumberList(barsWithState[0]?.shoppingIngredientIds),
    cocktailRatings: Object.keys(ratings).length > 0 ? ratings : undefined,
    cocktailComments: Object.keys(comments).length > 0 ? comments : undefined,
    partySelectedCocktailKeys:
      partySelection.length > 0 ? sanitizeStringList(partySelection.map((entry) => entry.cocktail_key)) : undefined,
    ignoreGarnish: Boolean(settings.get('ignoreGarnish') ?? true),
    allowAllSubstitutes: Boolean(settings.get('allowAllSubstitutes') ?? true),
    useImperialUnits: Boolean(settings.get('useImperialUnits') ?? false),
    keepScreenAwake: Boolean(settings.get('keepScreenAwake') ?? true),
    shakerSmartFilteringEnabled: Boolean(settings.get('shakerSmartFilteringEnabled') ?? false),
    showTabCounters: Boolean(settings.get('showTabCounters') ?? false),
    ratingFilterThreshold: Number(settings.get('ratingFilterThreshold') ?? 1),
    startScreen: (settings.get('startScreen') as string | null) ?? undefined,
    appTheme: (settings.get('appTheme') as string | null) ?? undefined,
    appLocale: (settings.get('appLocale') as string | null) ?? undefined,
    amazonStoreOverride: (settings.get('amazonStoreOverride') as string | null) ?? undefined,
    translationOverrides: Object.keys(translationOverrides).length > 0 ? translationOverrides : undefined,
    bars: barsWithState.length > 0 ? barsWithState : undefined,
    activeBarId: (settings.get('activeBarId') as string | null) ?? undefined,
    onboardingStep: Number(settings.get('onboardingStep') ?? 1),
    onboardingCompleted: Boolean(settings.get('onboardingCompleted') ?? false),
    onboardingStarterApplied: Boolean(settings.get('onboardingStarterApplied') ?? false),
  };
}

function createJsonStorageAdapter<TCocktail, TIngredient>(): InventoryStorageAdapter<TCocktail, TIngredient> {
  return {
    loadState: () => loadJsonInventorySnapshot<TCocktail, TIngredient>(),
    persistStateDelta: (snapshot) => persistJsonInventorySnapshot(snapshot),
    replaceState: (snapshot) => persistJsonInventorySnapshot(snapshot),
    clearState: async () => {
      const storagePath = resolveStoragePath();
      if (!storagePath) {
        return;
      }
      const info = await FileSystem.getInfoAsync(storagePath);
      if (info.exists) {
        await FileSystem.deleteAsync(storagePath, { idempotent: true });
      }
    },
    exportSnapshot: () => loadJsonInventorySnapshot<TCocktail, TIngredient>(),
    importSnapshot: (snapshot) => persistJsonInventorySnapshot(snapshot),
  };
}

function createSQLiteStorageAdapter<TCocktail, TIngredient>(): InventoryStorageAdapter<TCocktail, TIngredient> {
  const maybeMigrateFromJson = async () => {
    const db = await getSQLiteDatabase();
    const migrationFlag = await db.getFirstAsync<{ value: string | null }>(
      'SELECT value FROM settings WHERE key = ?;',
      SQLITE_MIGRATION_FLAG,
    );
    const hasMigrated = migrationFlag?.value ? Boolean(JSON.parse(migrationFlag.value)) : false;

    const existing = await loadV3SnapshotFromSQLite<TCocktail, TIngredient>(db);
    if (existing || hasMigrated) {
      return;
    }

    const jsonSnapshot = await loadJsonInventorySnapshot<TCocktail, TIngredient>();
    if (!jsonSnapshot) {
      await db.runAsync(
        'INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;',
        SQLITE_MIGRATION_FLAG,
        JSON.stringify(true),
      );
      return;
    }

    const normalized = normalizeLegacySnapshot(jsonSnapshot);
    await withTransaction(db, async () => {
      await db.runAsync('DELETE FROM cocktails;');
      await db.runAsync('DELETE FROM ingredients;');
      await db.runAsync('DELETE FROM deleted_cocktails;');
      await db.runAsync('DELETE FROM deleted_ingredients;');
      await applyEntityDelta(db, 'cocktails', 'deleted_cocktails', normalized.delta.cocktails);
      await applyEntityDelta(db, 'ingredients', 'deleted_ingredients', normalized.delta.ingredients);
      await persistMetadata(db, normalized);
      await db.runAsync(
        'INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;',
        SQLITE_MIGRATION_FLAG,
        JSON.stringify(true),
      );
    });
  };

  return {
    loadState: async () => {
      await maybeMigrateFromJson();
      const db = await getSQLiteDatabase();
      return loadV3SnapshotFromSQLite<TCocktail, TIngredient>(db);
    },
    persistStateDelta: async (snapshot) => {
      const db = await getSQLiteDatabase();
      await withTransaction(db, async () => {
        await applyEntityDelta(db, 'cocktails', 'deleted_cocktails', snapshot.delta.cocktails);
        await applyEntityDelta(db, 'ingredients', 'deleted_ingredients', snapshot.delta.ingredients);
        await persistMetadata(db, snapshot);
      });
    },
    replaceState: async (snapshot) => {
      const db = await getSQLiteDatabase();
      const normalized = normalizeLegacySnapshot(snapshot);
      await withTransaction(db, async () => {
        await db.runAsync('DELETE FROM cocktails;');
        await db.runAsync('DELETE FROM ingredients;');
        await db.runAsync('DELETE FROM deleted_cocktails;');
        await db.runAsync('DELETE FROM deleted_ingredients;');
        await applyEntityDelta(db, 'cocktails', 'deleted_cocktails', normalized.delta.cocktails);
        await applyEntityDelta(db, 'ingredients', 'deleted_ingredients', normalized.delta.ingredients);
        await persistMetadata(db, normalized);
      });
    },
    clearState: async () => {
      const db = await getSQLiteDatabase();
      await withTransaction(db, async () => {
        await db.runAsync('DELETE FROM cocktails;');
        await db.runAsync('DELETE FROM ingredients;');
        await db.runAsync('DELETE FROM deleted_cocktails;');
        await db.runAsync('DELETE FROM deleted_ingredients;');
        await db.runAsync('DELETE FROM custom_tags;');
        await db.runAsync('DELETE FROM settings;');
        await db.runAsync('DELETE FROM bars;');
        await db.runAsync('DELETE FROM bar_state;');
        await db.runAsync('DELETE FROM feedback;');
        await db.runAsync('DELETE FROM party_selection;');
        await db.runAsync('DELETE FROM translation_overrides;');
      });
    },
    exportSnapshot: async () => {
      const db = await getSQLiteDatabase();
      return loadV3SnapshotFromSQLite<TCocktail, TIngredient>(db);
    },
    importSnapshot: async (snapshot) => {
      const db = await getSQLiteDatabase();
      const normalized = normalizeLegacySnapshot(snapshot);
      await withTransaction(db, async () => {
        await applyEntityDelta(db, 'cocktails', 'deleted_cocktails', normalized.delta.cocktails);
        await applyEntityDelta(db, 'ingredients', 'deleted_ingredients', normalized.delta.ingredients);
        await persistMetadata(db, normalized);
      });
    },
  };
}

let activeStorageAdapter: InventoryStorageAdapter<unknown, unknown> | undefined;

export function getInventoryStorageAdapter<TCocktail, TIngredient>(): InventoryStorageAdapter<TCocktail, TIngredient> {
  if (!activeStorageAdapter) {
    activeStorageAdapter = USE_SQLITE_STORAGE
      ? createSQLiteStorageAdapter<unknown, unknown>()
      : createJsonStorageAdapter<unknown, unknown>();
  }

  return activeStorageAdapter as InventoryStorageAdapter<TCocktail, TIngredient>;
}

export async function loadInventorySnapshot<TCocktail, TIngredient>(): Promise<
  InventorySnapshot<TCocktail, TIngredient> | undefined
> {
  return getInventoryStorageAdapter<TCocktail, TIngredient>().loadState();
}

export async function persistInventorySnapshot<TCocktail, TIngredient>(
  snapshot: InventorySnapshot<TCocktail, TIngredient>,
): Promise<void> {
  return getInventoryStorageAdapter<TCocktail, TIngredient>().replaceState(snapshot);
}

export async function persistInventorySnapshotDelta<TCocktail, TIngredient>(
  snapshot: InventoryDeltaSnapshotV3<TCocktail, TIngredient>,
): Promise<void> {
  return getInventoryStorageAdapter<TCocktail, TIngredient>().persistStateDelta(snapshot);
}

export async function clearInventorySnapshot<TCocktail, TIngredient>(): Promise<void> {
  return getInventoryStorageAdapter<TCocktail, TIngredient>().clearState();
}

export async function exportInventorySnapshot<TCocktail, TIngredient>(): Promise<
  InventorySnapshot<TCocktail, TIngredient> | undefined
> {
  return getInventoryStorageAdapter<TCocktail, TIngredient>().exportSnapshot();
}

export async function importInventorySnapshot<TCocktail, TIngredient>(
  snapshot: InventorySnapshot<TCocktail, TIngredient>,
): Promise<void> {
  return getInventoryStorageAdapter<TCocktail, TIngredient>().importSnapshot(snapshot);
}

export const __inventoryStorageTesting = {
  normalizeLegacySnapshot,
  sanitizeStringList,
  sanitizeNumberList,
  withTransaction,
};
