import * as SQLite from 'expo-sqlite';

import {
  fileStorageAdapter,
  readRawCocktailTagDeltaSnapshot,
  readRawFileSnapshot,
} from '@/libs/storage/file-storage';
import { syncBundledCatalogIfNeeded as syncBundledCatalogTables } from '@/libs/storage/sqlite/catalog-sync';
import { ensureBarsTableShape, ensureRuntimeColumnShape, ensureSqliteSchema } from '@/libs/storage/sqlite/migrations';
import { APP_STATE_KEYS, SQLITE_DB_NAME } from '@/libs/storage/sqlite/schema';
import type {
  CocktailTagDeltaSnapshot,
  InventoryDeltaSnapshotV3,
  InventorySnapshot,
  InventoryStorageAdapter,
} from '@/libs/storage/types';
import type { Bar } from '@/providers/inventory-types';

type RowValue = string | number | null;

type PersistedSnapshot<TCocktail, TIngredient> = Partial<InventoryDeltaSnapshotV3<TCocktail, TIngredient>> & {
  version: number;
  delta?: {
    cocktails?: { created?: TCocktail[]; updated?: TCocktail[]; deletedIds?: number[] };
    ingredients?: { created?: TIngredient[]; updated?: TIngredient[]; deletedIds?: number[] };
  };
  bars?: Bar[];
  activeBarId?: string;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | undefined;
let initializePromise: Promise<void> | undefined;
let dbOperationQueue: Promise<void> = Promise.resolve();

function runSerialized<T>(operation: () => Promise<T>): Promise<T> {
  const result = dbOperationQueue.then(operation, operation);
  dbOperationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(SQLITE_DB_NAME);
  }

  return dbPromise;
}

function nowTs(): number {
  return Date.now();
}

async function setAppState(db: SQLite.SQLiteDatabase, key: string, value: unknown): Promise<void> {
  await db.runAsync(
    `INSERT INTO app_state (key, value_json, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at`,
    [key, JSON.stringify(value), nowTs()],
  );
}

async function getAppState(db: SQLite.SQLiteDatabase, key: string): Promise<unknown> {
  const row = await db.getFirstAsync<{ value_json: string }>('SELECT value_json FROM app_state WHERE key = ?', [key]);
  if (!row) {
    return undefined;
  }

  try {
    return JSON.parse(row.value_json);
  } catch {
    return undefined;
  }
}

async function clearSoftDeleteTable(db: SQLite.SQLiteDatabase, table: 'custom_cocktail_tags' | 'custom_ingredient_tags'): Promise<void> {
  await db.runAsync(`UPDATE ${table} SET deleted_at = ?`, [nowTs()]);
}

async function writeTags(
  db: SQLite.SQLiteDatabase,
  table: 'custom_cocktail_tags' | 'custom_ingredient_tags',
  tags?: Array<{ id: number; name: string; color: string }>,
): Promise<void> {
  await ensureRuntimeColumnShape(db);
  await clearSoftDeleteTable(db, table);
  for (const tag of tags ?? []) {
    const id = Math.trunc(Number(tag.id ?? -1));
    if (!Number.isFinite(id) || id < 0) {
      continue;
    }

    await db.runAsync(
      `INSERT INTO ${table} (id, name, color, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, NULL)
       ON CONFLICT(id)
       DO UPDATE SET name=excluded.name, color=excluded.color, updated_at=excluded.updated_at, deleted_at=NULL`,
      [id, tag.name, tag.color, nowTs()],
    );
  }
}

async function writeBars(db: SQLite.SQLiteDatabase, bars: Bar[] | undefined): Promise<void> {
  await ensureBarsTableShape(db);
  await db.execAsync('DELETE FROM bars');

  for (const bar of bars ?? []) {
    if (!bar?.id) {
      continue;
    }

    await db.runAsync(
      'INSERT INTO bars (id, payload_json, updated_at) VALUES (?, ?, ?)',
      [bar.id, JSON.stringify(bar), nowTs()],
    );
  }
}

async function writeIngredientFlags(
  db: SQLite.SQLiteDatabase,
  availableIds?: number[],
  shoppingIds?: number[],
): Promise<void> {
  await db.execAsync('DELETE FROM ingredient_flags');

  const allIds = new Set<number>();
  for (const id of availableIds ?? []) {
    allIds.add(Math.trunc(Number(id)));
  }
  for (const id of shoppingIds ?? []) {
    allIds.add(Math.trunc(Number(id)));
  }

  for (const id of allIds) {
    if (!Number.isFinite(id) || id < 0) {
      continue;
    }

    await db.runAsync(
      'INSERT INTO ingredient_flags (ingredient_id, is_available, is_shopping, updated_at) VALUES (?, ?, ?, ?)',
      [id, (availableIds ?? []).includes(id) ? 1 : 0, (shoppingIds ?? []).includes(id) ? 1 : 0, nowTs()],
    );
  }
}

async function writeRatings(
  db: SQLite.SQLiteDatabase,
  ratings?: Record<string, number>,
  comments?: Record<string, string>,
): Promise<void> {
  await db.execAsync('DELETE FROM cocktail_ratings');
  const keys = new Set<string>([...Object.keys(ratings ?? {}), ...Object.keys(comments ?? {})]);

  for (const key of keys) {
    await db.runAsync(
      'INSERT INTO cocktail_ratings (cocktail_key, rating, comment, updated_at) VALUES (?, ?, ?, ?)',
      [key, ratings?.[key] ?? null, comments?.[key] ?? null, nowTs()],
    );
  }
}

async function writeEntityOverrides(
  db: SQLite.SQLiteDatabase,
  entityType: 'cocktail' | 'ingredient',
  section?: { created?: unknown[]; updated?: unknown[]; deletedIds?: number[] },
): Promise<void> {
  const created = section?.created ?? [];
  const updated = section?.updated ?? [];
  const deletedIds = section?.deletedIds ?? [];
  for (const row of [...created, ...updated] as Array<{ id?: number }>) {
    const id = Math.trunc(Number(row?.id ?? -1));
    if (!Number.isFinite(id) || id < 0) {
      continue;
    }

    await db.runAsync(
      `INSERT INTO user_entity_overrides (entity_type, entity_id, payload_json, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, NULL)
       ON CONFLICT(entity_type, entity_id)
       DO UPDATE SET payload_json=excluded.payload_json, updated_at=excluded.updated_at, deleted_at=NULL`,
      [entityType, id, JSON.stringify(row), nowTs()],
    );
  }

  for (const rawId of deletedIds) {
    const id = Math.trunc(Number(rawId ?? -1));
    if (!Number.isFinite(id) || id < 0) {
      continue;
    }

    await db.runAsync(
      `INSERT INTO user_entity_overrides (entity_type, entity_id, payload_json, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(entity_type, entity_id)
       DO UPDATE SET payload_json=excluded.payload_json, updated_at=excluded.updated_at, deleted_at=excluded.deleted_at`,
      [entityType, id, JSON.stringify({ id }), nowTs(), nowTs()],
    );
  }
}

async function writeCocktailTagDelta(db: SQLite.SQLiteDatabase, delta: CocktailTagDeltaSnapshot): Promise<void> {
  await db.execAsync('DELETE FROM cocktail_tag_delta');
  for (const [cocktailKey, payload] of Object.entries(delta ?? {})) {
    await db.runAsync(
      'INSERT INTO cocktail_tag_delta (cocktail_key, payload_json, updated_at) VALUES (?, ?, ?)',
      [cocktailKey, payload == null ? null : JSON.stringify(payload), nowTs()],
    );
  }
}

async function hydrateSnapshot<TCocktail, TIngredient>(db: SQLite.SQLiteDatabase): Promise<InventorySnapshot<TCocktail, TIngredient> | undefined> {
  await ensureBarsTableShape(db);
  await ensureRuntimeColumnShape(db);
  const version = Number((await getAppState(db, 'snapshotVersion')) ?? 0);
  if (version <= 0) {
    return undefined;
  }

  const barsRows = await db.getAllAsync<{ payload_json: string }>('SELECT payload_json FROM bars ORDER BY updated_at ASC');
  const ingredientRows = await db.getAllAsync<{ ingredient_id: number; is_available: number; is_shopping: number }>('SELECT ingredient_id, is_available, is_shopping FROM ingredient_flags');
  const ratingRows = await db.getAllAsync<{ cocktail_key: string; rating: number | null; comment: string | null }>('SELECT cocktail_key, rating, comment FROM cocktail_ratings');
  const cocktailTagRows = await db.getAllAsync<{ id: number; name: string; color: string }>(
    'SELECT id, name, color FROM custom_cocktail_tags WHERE deleted_at IS NULL ORDER BY id ASC',
  );
  const ingredientTagRows = await db.getAllAsync<{ id: number; name: string; color: string }>(
    'SELECT id, name, color FROM custom_ingredient_tags WHERE deleted_at IS NULL ORDER BY id ASC',
  );
  const cocktailOverrides = await db.getAllAsync<{ payload_json: string; deleted_at: number | null }>(
    `SELECT payload_json, deleted_at FROM user_entity_overrides WHERE entity_type='cocktail'`,
  );
  const ingredientOverrides = await db.getAllAsync<{ payload_json: string; deleted_at: number | null }>(
    `SELECT payload_json, deleted_at FROM user_entity_overrides WHERE entity_type='ingredient'`,
  );

  const cocktailsCreatedOrUpdated: TCocktail[] = [];
  const cocktailsDeletedIds: number[] = [];
  for (const row of cocktailOverrides) {
    if (row.deleted_at) {
      try {
        const parsed = JSON.parse(row.payload_json) as { id?: number };
        if (parsed.id != null) {
          cocktailsDeletedIds.push(parsed.id);
        }
      } catch {
        // Ignore malformed rows.
      }
      continue;
    }

    try {
      cocktailsCreatedOrUpdated.push(JSON.parse(row.payload_json) as TCocktail);
    } catch {
      // Ignore malformed rows.
    }
  }

  const ingredientsCreatedOrUpdated: TIngredient[] = [];
  const ingredientsDeletedIds: number[] = [];
  for (const row of ingredientOverrides) {
    if (row.deleted_at) {
      try {
        const parsed = JSON.parse(row.payload_json) as { id?: number };
        if (parsed.id != null) {
          ingredientsDeletedIds.push(parsed.id);
        }
      } catch {
        // Ignore malformed rows.
      }
      continue;
    }

    try {
      ingredientsCreatedOrUpdated.push(JSON.parse(row.payload_json) as TIngredient);
    } catch {
      // Ignore malformed rows.
    }
  }

  const ratings: Record<string, number> = {};
  const comments: Record<string, string> = {};
  for (const row of ratingRows) {
    if (row.rating != null) {
      ratings[row.cocktail_key] = Number(row.rating);
    }
    if (row.comment) {
      comments[row.cocktail_key] = row.comment;
    }
  }

  const availableIngredientIds = ingredientRows
    .filter((row: { is_available: number }) => row.is_available === 1)
    .map((row: { ingredient_id: number }) => row.ingredient_id);
  const shoppingIngredientIds = ingredientRows
    .filter((row: { is_shopping: number }) => row.is_shopping === 1)
    .map((row: { ingredient_id: number }) => row.ingredient_id);

  const snapshot: InventoryDeltaSnapshotV3<TCocktail, TIngredient> = {
    version: 3,
    delta: {
      cocktails: {
        created: cocktailsCreatedOrUpdated,
        updated: [],
        deletedIds: cocktailsDeletedIds,
      },
      ingredients: {
        created: ingredientsCreatedOrUpdated,
        updated: [],
        deletedIds: ingredientsDeletedIds,
      },
    },
    imported: Boolean(await getAppState(db, APP_STATE_KEYS.imported)),
    customCocktailTags: cocktailTagRows,
    customIngredientTags: ingredientTagRows,
    availableIngredientIds,
    shoppingIngredientIds,
    cocktailRatings: ratings,
    cocktailComments: comments,
    partySelectedCocktailKeys: (await getAppState(db, APP_STATE_KEYS.partySelectedCocktailKeys) as string[] | undefined) ?? [],
    ignoreGarnish: Boolean(await getAppState(db, APP_STATE_KEYS.ignoreGarnish)),
    allowAllSubstitutes: Boolean(await getAppState(db, APP_STATE_KEYS.allowAllSubstitutes)),
    useImperialUnits: Boolean(await getAppState(db, APP_STATE_KEYS.useImperialUnits)),
    keepScreenAwake: Boolean(await getAppState(db, APP_STATE_KEYS.keepScreenAwake)),
    shakerSmartFilteringEnabled: Boolean(await getAppState(db, APP_STATE_KEYS.shakerSmartFilteringEnabled)),
    showTabCounters: Boolean(await getAppState(db, APP_STATE_KEYS.showTabCounters)),
    ratingFilterThreshold: Number(await getAppState(db, APP_STATE_KEYS.ratingFilterThreshold) ?? 1),
    startScreen: String(await getAppState(db, APP_STATE_KEYS.startScreen) ?? 'cocktails_all'),
    appTheme: String(await getAppState(db, APP_STATE_KEYS.appTheme) ?? 'system'),
    appLocale: String(await getAppState(db, APP_STATE_KEYS.appLocale) ?? 'en-US'),
    amazonStoreOverride: (await getAppState(db, APP_STATE_KEYS.amazonStoreOverride) as string | null | undefined) ?? null,
    translationOverrides: (await getAppState(db, APP_STATE_KEYS.translationOverrides) as unknown) ?? {},
    bars: barsRows
      .map((row: { payload_json: string }) => {
        try {
          return JSON.parse(row.payload_json) as Bar;
        } catch {
          return undefined;
        }
      })
      .filter((row: Bar | undefined): row is Bar => Boolean(row?.id)),
    activeBarId: String(await getAppState(db, APP_STATE_KEYS.activeBarId) ?? ''),
    onboardingStep: Number(await getAppState(db, APP_STATE_KEYS.onboardingStep) ?? 1),
    onboardingCompleted: Boolean(await getAppState(db, APP_STATE_KEYS.onboardingCompleted)),
    onboardingStarterApplied: Boolean(await getAppState(db, APP_STATE_KEYS.onboardingStarterApplied)),
  };

  return snapshot as InventorySnapshot<TCocktail, TIngredient>;
}

async function hasExistingUserData(db: SQLite.SQLiteDatabase): Promise<boolean> {
  const bars = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM bars');
  const overrides = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM user_entity_overrides');
  return (bars?.count ?? 0) > 0 || (overrides?.count ?? 0) > 0;
}

async function importFileSnapshotIfNeeded(db: SQLite.SQLiteDatabase): Promise<void> {
  const alreadyImported = Boolean(await getAppState(db, APP_STATE_KEYS.fileImportCompleted));
  if (alreadyImported) {
    return;
  }

  if (await hasExistingUserData(db)) {
    await setAppState(db, APP_STATE_KEYS.fileImportCompleted, true);
    return;
  }

  const rawSnapshot = await readRawFileSnapshot();
  const rawTagDelta = await readRawCocktailTagDeltaSnapshot();

  if (!rawSnapshot) {
    await setAppState(db, APP_STATE_KEYS.fileImportCompleted, true);
    return;
  }

  try {
    const parsedSnapshot = JSON.parse(rawSnapshot) as InventorySnapshot<unknown, unknown>;
    await persistInventorySnapshotInternal(db, parsedSnapshot);

    if (rawTagDelta) {
      const parsedTagDelta = JSON.parse(rawTagDelta) as CocktailTagDeltaSnapshot;
      await writeCocktailTagDelta(db, parsedTagDelta);
    }

    await setAppState(db, APP_STATE_KEYS.fileImportCompleted, true);
    console.info('[sqlite] imported inventory snapshot from file storage');
  } catch (error) {
    console.error('[sqlite] failed to import file snapshot', error);
    throw error;
  }
}

async function initializeSqliteStorage(): Promise<void> {
  if (initializePromise) {
    return initializePromise;
  }

  initializePromise = (async () => {
    const db = await getDb();
    await ensureSqliteSchema(db);
    await ensureBarsTableShape(db);
    await ensureRuntimeColumnShape(db);
    await syncBundledCatalogTables(db);
    await importFileSnapshotIfNeeded(db);
  })().catch((error) => {
    initializePromise = undefined;
    throw error;
  });

  return initializePromise;
}

async function persistInventorySnapshotInternal<TCocktail, TIngredient>(
  db: SQLite.SQLiteDatabase,
  snapshot: InventorySnapshot<TCocktail, TIngredient>,
): Promise<void> {
  const snap = snapshot as PersistedSnapshot<TCocktail, TIngredient>;
  await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
  try {
    await setAppState(db, 'snapshotVersion', Number(snap.version ?? 3));
    await setAppState(db, APP_STATE_KEYS.imported, Boolean(snap.imported));
    await setAppState(db, APP_STATE_KEYS.partySelectedCocktailKeys, snap.partySelectedCocktailKeys ?? []);
    await setAppState(db, APP_STATE_KEYS.ignoreGarnish, Boolean(snap.ignoreGarnish));
    await setAppState(db, APP_STATE_KEYS.allowAllSubstitutes, Boolean(snap.allowAllSubstitutes));
    await setAppState(db, APP_STATE_KEYS.useImperialUnits, Boolean(snap.useImperialUnits));
    await setAppState(db, APP_STATE_KEYS.keepScreenAwake, Boolean(snap.keepScreenAwake));
    await setAppState(db, APP_STATE_KEYS.shakerSmartFilteringEnabled, Boolean(snap.shakerSmartFilteringEnabled));
    await setAppState(db, APP_STATE_KEYS.showTabCounters, Boolean(snap.showTabCounters));
    await setAppState(db, APP_STATE_KEYS.ratingFilterThreshold, snap.ratingFilterThreshold ?? 1);
    await setAppState(db, APP_STATE_KEYS.startScreen, snap.startScreen ?? 'cocktails_all');
    await setAppState(db, APP_STATE_KEYS.appTheme, snap.appTheme ?? 'system');
    await setAppState(db, APP_STATE_KEYS.appLocale, snap.appLocale ?? 'en-US');
    await setAppState(db, APP_STATE_KEYS.amazonStoreOverride, snap.amazonStoreOverride ?? null);
    await setAppState(db, APP_STATE_KEYS.translationOverrides, (snap as { translationOverrides?: unknown }).translationOverrides ?? {});
    await setAppState(db, APP_STATE_KEYS.activeBarId, snap.activeBarId ?? '');
    await setAppState(db, APP_STATE_KEYS.onboardingStep, snap.onboardingStep ?? 1);
    await setAppState(db, APP_STATE_KEYS.onboardingCompleted, Boolean(snap.onboardingCompleted));
    await setAppState(db, APP_STATE_KEYS.onboardingStarterApplied, Boolean(snap.onboardingStarterApplied));

    await writeBars(db, snap.bars);
    await writeTags(db, 'custom_cocktail_tags', snap.customCocktailTags);
    await writeTags(db, 'custom_ingredient_tags', snap.customIngredientTags);
    await writeIngredientFlags(db, snap.availableIngredientIds, snap.shoppingIngredientIds);
    await writeRatings(db, snap.cocktailRatings, snap.cocktailComments);

    await writeEntityOverrides(db, 'cocktail', snap.delta?.cocktails);
    await writeEntityOverrides(db, 'ingredient', snap.delta?.ingredients);

    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}

const sqliteStorageAdapter: InventoryStorageAdapter = {
  async loadInventorySnapshot<TCocktail, TIngredient>() {
    return runSerialized(async () => {
      try {
        await initializeSqliteStorage();
        const db = await getDb();
        return await hydrateSnapshot<TCocktail, TIngredient>(db);
      } catch (error) {
        console.error('[sqlite] loadInventorySnapshot failed; falling back to file storage', error);
        return fileStorageAdapter.loadInventorySnapshot<TCocktail, TIngredient>();
      }
    });
  },

  async persistInventorySnapshot<TCocktail, TIngredient>(snapshot: InventorySnapshot<TCocktail, TIngredient>) {
    return runSerialized(async () => {
      try {
        await initializeSqliteStorage();
        const db = await getDb();
        await persistInventorySnapshotInternal(db, snapshot);
      } catch (error) {
        console.error('[sqlite] persistInventorySnapshot failed; falling back to file storage', error);
        await fileStorageAdapter.persistInventorySnapshot(snapshot);
      }
    });
  },

  async loadCocktailTagDeltaSnapshot() {
    return runSerialized(async () => {
      try {
        await initializeSqliteStorage();
        const db = await getDb();
        const rows = await db.getAllAsync<{ cocktail_key: string; payload_json: RowValue }>(
          'SELECT cocktail_key, payload_json FROM cocktail_tag_delta',
        );
        const result: CocktailTagDeltaSnapshot = {};
        for (const row of rows) {
          if (row.payload_json == null) {
            result[row.cocktail_key] = null;
            continue;
          }
          result[row.cocktail_key] = JSON.parse(String(row.payload_json)) as Array<{ id: number; name?: string; color?: string }>;
        }
        return result;
      } catch (error) {
        console.error('[sqlite] loadCocktailTagDeltaSnapshot failed; falling back to file storage', error);
        return fileStorageAdapter.loadCocktailTagDeltaSnapshot();
      }
    });
  },

  async persistCocktailTagDeltaSnapshot(snapshot: CocktailTagDeltaSnapshot) {
    return runSerialized(async () => {
      try {
        await initializeSqliteStorage();
        const db = await getDb();
        await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
        try {
          await writeCocktailTagDelta(db, snapshot);
          await db.execAsync('COMMIT');
        } catch (error) {
          await db.execAsync('ROLLBACK');
          throw error;
        }
      } catch (error) {
        console.error('[sqlite] persistCocktailTagDeltaSnapshot failed; falling back to file storage', error);
        await fileStorageAdapter.persistCocktailTagDeltaSnapshot(snapshot);
      }
    });
  },

  async syncBundledCatalogIfNeeded() {
    await runSerialized(async () => {
      await initializeSqliteStorage();
    });
  },
};

export default sqliteStorageAdapter;
