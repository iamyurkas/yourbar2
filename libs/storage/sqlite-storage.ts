import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { fileStorageAdapter } from '@/libs/storage/file-storage';
import { syncBundledCatalogIfNeededInTransaction } from '@/libs/storage/sqlite/catalog-sync';
import { migrateAndRepairSchema, runShapeCorrection, type MigrationDb } from '@/libs/storage/sqlite/migrations';
import { SQLITE_DB_NAME } from '@/libs/storage/sqlite/schema';
import type { CocktailTagDeltaSnapshot, InventorySnapshot, InventoryStorageAdapter } from '@/libs/storage/types';

export class SQLiteOperationQueue {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.tail.then(operation, operation);
    this.tail = next.then(() => undefined, () => undefined);
    return next;
  }
}

type OverrideRow = {
  entity_id: number;
  payload_json: string | null;
  source: string | null;
  deleted_at: string | null;
};

let dbPromise: Promise<SQLiteDatabase> | undefined;
let initPromise: Promise<void> | undefined;
let importAttempted = false;
const queue = new SQLiteOperationQueue();

async function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabaseAsync(SQLITE_DB_NAME);
  }

  return dbPromise;
}

function asMigrationDb(db: SQLiteDatabase): MigrationDb {
  return {
    execAsync: (sql: string) => db.execAsync(sql),
    getAllAsync: <T>(sql: string, ...params: unknown[]) => db.getAllAsync<T>(sql, params),
    getFirstAsync: <T>(sql: string, ...params: unknown[]) => db.getFirstAsync<T>(sql, params),
  };
}

async function runInTransaction<T>(db: SQLiteDatabase, work: (migrationDb: MigrationDb) => Promise<T>): Promise<T> {
  const migrationDb = asMigrationDb(db);
  await db.execAsync('BEGIN IMMEDIATE TRANSACTION;');
  try {
    const result = await work(migrationDb);
    await db.execAsync('COMMIT;');
    return result;
  } catch (error) {
    await db.execAsync('ROLLBACK;');
    throw error;
  }
}

async function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = queue.run(async () => {
      const db = await getDb();
      await runInTransaction(db, async (migrationDb) => {
        await migrateAndRepairSchema(migrationDb);
        await syncBundledCatalogIfNeededInTransaction(migrationDb);
      });
    });
  }

  await initPromise;
}

function toJson(value: unknown): string {
  return JSON.stringify(value);
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function maybeImportFromFileSnapshot(migrationDb: MigrationDb): Promise<void> {
  if (importAttempted) {
    return;
  }

  importAttempted = true;
  const alreadyImported = await migrationDb.getFirstAsync<{ name: string }>(
    `SELECT name FROM import_markers WHERE name='file_snapshot_import_v1' LIMIT 1;`,
  );
  if (alreadyImported?.name) {
    return;
  }

  const fileSnapshot = await fileStorageAdapter.loadInventoryState();
  const tagDelta = await fileStorageAdapter.loadCocktailTagDelta();
  if (!fileSnapshot) {
    await migrationDb.execAsync(`INSERT OR IGNORE INTO import_markers(name, completed_at) VALUES ('file_snapshot_import_v1', datetime('now'));`);
    return;
  }

  await persistInventorySnapshotInTransaction(migrationDb, fileSnapshot);
  await persistCocktailTagDeltaInTransaction(migrationDb, tagDelta);
  await migrationDb.execAsync(`INSERT OR IGNORE INTO import_markers(name, completed_at) VALUES ('file_snapshot_import_v1', datetime('now'));`);
  console.info('[storage/sqlite] one-time file snapshot import completed');
}

async function persistSettingsMap(migrationDb: MigrationDb, snapshot: Record<string, unknown>): Promise<void> {
  for (const [key, value] of Object.entries(snapshot)) {
    await migrationDb.execAsync(
      `INSERT INTO settings (key, value_json, updated_at) VALUES (${JSON.stringify(key)}, ${JSON.stringify(toJson(value))}, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json, updated_at=datetime('now');`,
    );
  }
}

async function persistInventorySnapshotInTransaction<TCocktail, TIngredient>(
  migrationDb: MigrationDb,
  snapshot: InventorySnapshot<TCocktail, TIngredient>,
): Promise<void> {
  await runShapeCorrection(migrationDb);

  if (!('delta' in snapshot)) {
    await persistSettingsMap(migrationDb, { legacy_snapshot: snapshot });
    return;
  }

  const delta = snapshot.delta;
  await migrationDb.execAsync(`DELETE FROM user_entity_overrides WHERE entity_type IN ('cocktail', 'ingredient');`);

  const upsertOverride = async (
    entityType: 'cocktail' | 'ingredient',
    entityId: number,
    payload: unknown,
    source: 'created' | 'updated',
    deletedAt: string | null,
  ) => {
    await migrationDb.execAsync(
      `INSERT INTO user_entity_overrides(entity_type, entity_id, payload_json, source, deleted_at, updated_at)
       VALUES (${JSON.stringify(entityType)}, ${entityId}, ${payload == null ? 'NULL' : JSON.stringify(toJson(payload))}, ${JSON.stringify(source)}, ${deletedAt ? JSON.stringify(deletedAt) : 'NULL'}, datetime('now'))
       ON CONFLICT(entity_type, entity_id) DO UPDATE SET
         payload_json=excluded.payload_json,
         source=excluded.source,
         deleted_at=excluded.deleted_at,
         updated_at=datetime('now');`,
    );
  };

  for (const item of delta.cocktails?.created ?? []) {
    const id = Number((item as { id?: number }).id ?? -1);
    if (Number.isFinite(id) && id >= 0) {
      await upsertOverride('cocktail', Math.trunc(id), item, 'created', null);
    }
  }
  for (const item of delta.cocktails?.updated ?? []) {
    const id = Number((item as { id?: number }).id ?? -1);
    if (Number.isFinite(id) && id >= 0) {
      await upsertOverride('cocktail', Math.trunc(id), item, 'updated', null);
    }
  }
  for (const id of delta.cocktails?.deletedIds ?? []) {
    if (Number.isFinite(id) && id >= 0) {
      await upsertOverride('cocktail', Math.trunc(id), null, 'updated', new Date().toISOString());
    }
  }

  for (const item of delta.ingredients?.created ?? []) {
    const id = Number((item as { id?: number }).id ?? -1);
    if (Number.isFinite(id) && id >= 0) {
      await upsertOverride('ingredient', Math.trunc(id), item, 'created', null);
    }
  }
  for (const item of delta.ingredients?.updated ?? []) {
    const id = Number((item as { id?: number }).id ?? -1);
    if (Number.isFinite(id) && id >= 0) {
      await upsertOverride('ingredient', Math.trunc(id), item, 'updated', null);
    }
  }
  for (const id of delta.ingredients?.deletedIds ?? []) {
    if (Number.isFinite(id) && id >= 0) {
      await upsertOverride('ingredient', Math.trunc(id), null, 'updated', new Date().toISOString());
    }
  }

  await migrationDb.execAsync('DELETE FROM custom_cocktail_tags;');
  for (const tag of snapshot.customCocktailTags ?? []) {
    await migrationDb.execAsync(
      `INSERT INTO custom_cocktail_tags(id, name, color, deleted_at, updated_at)
       VALUES (${tag.id}, ${JSON.stringify(tag.name)}, ${JSON.stringify(tag.color)}, NULL, datetime('now'));`,
    );
  }

  await migrationDb.execAsync('DELETE FROM custom_ingredient_tags;');
  for (const tag of snapshot.customIngredientTags ?? []) {
    await migrationDb.execAsync(
      `INSERT INTO custom_ingredient_tags(id, name, color, deleted_at, updated_at)
       VALUES (${tag.id}, ${JSON.stringify(tag.name)}, ${JSON.stringify(tag.color)}, NULL, datetime('now'));`,
    );
  }

  await migrationDb.execAsync(`DELETE FROM list_membership WHERE list_name IN ('available_ingredient_ids', 'shopping_ingredient_ids');`);
  for (const id of snapshot.availableIngredientIds ?? []) {
    await migrationDb.execAsync(
      `INSERT OR IGNORE INTO list_membership(list_name, entity_type, entity_id, updated_at)
       VALUES ('available_ingredient_ids', 'ingredient', ${id}, datetime('now'));`,
    );
  }
  for (const id of snapshot.shoppingIngredientIds ?? []) {
    await migrationDb.execAsync(
      `INSERT OR IGNORE INTO list_membership(list_name, entity_type, entity_id, updated_at)
       VALUES ('shopping_ingredient_ids', 'ingredient', ${id}, datetime('now'));`,
    );
  }

  await migrationDb.execAsync('DELETE FROM cocktail_feedback;');
  for (const [cocktailKey, rating] of Object.entries(snapshot.cocktailRatings ?? {})) {
    const comment = snapshot.cocktailComments?.[cocktailKey] ?? null;
    await migrationDb.execAsync(
      `INSERT INTO cocktail_feedback(cocktail_key, rating, comment, updated_at)
       VALUES (${JSON.stringify(cocktailKey)}, ${Math.round(rating)}, ${comment == null ? 'NULL' : JSON.stringify(comment)}, datetime('now'))
       ON CONFLICT(cocktail_key) DO UPDATE SET rating=excluded.rating, comment=excluded.comment, updated_at=datetime('now');`,
    );
  }
  for (const [cocktailKey, comment] of Object.entries(snapshot.cocktailComments ?? {})) {
    if (snapshot.cocktailRatings?.[cocktailKey] != null) {
      continue;
    }
    await migrationDb.execAsync(
      `INSERT INTO cocktail_feedback(cocktail_key, rating, comment, updated_at)
       VALUES (${JSON.stringify(cocktailKey)}, NULL, ${JSON.stringify(comment)}, datetime('now'))
       ON CONFLICT(cocktail_key) DO UPDATE SET comment=excluded.comment, updated_at=datetime('now');`,
    );
  }

  await migrationDb.execAsync('DELETE FROM party_selection;');
  for (const key of snapshot.partySelectedCocktailKeys ?? []) {
    await migrationDb.execAsync(
      `INSERT OR IGNORE INTO party_selection(cocktail_key, updated_at)
       VALUES (${JSON.stringify(key)}, datetime('now'));`,
    );
  }

  await migrationDb.execAsync('DELETE FROM bars;');
  const bars = 'bars' in snapshot ? snapshot.bars ?? [] : [];
  for (const bar of bars) {
    const barId = String((bar as { id?: string }).id ?? '').trim();
    if (!barId) {
      continue;
    }

    await migrationDb.execAsync(
      `INSERT INTO bars(id, payload_json, updated_at, deleted_at)
       VALUES (${JSON.stringify(barId)}, ${JSON.stringify(toJson(bar))}, datetime('now'), NULL)
       ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json, updated_at=datetime('now'), deleted_at=NULL;`,
    );
  }

  await persistSettingsMap(migrationDb, {
    version: snapshot.version,
    imported: Boolean(snapshot.imported),
    ignoreGarnish: Boolean(snapshot.ignoreGarnish),
    allowAllSubstitutes: Boolean(snapshot.allowAllSubstitutes),
    useImperialUnits: Boolean(snapshot.useImperialUnits),
    keepScreenAwake: Boolean(snapshot.keepScreenAwake),
    shakerSmartFilteringEnabled: Boolean(snapshot.shakerSmartFilteringEnabled),
    showTabCounters: Boolean(snapshot.showTabCounters),
    ratingFilterThreshold: snapshot.ratingFilterThreshold ?? 1,
    startScreen: snapshot.startScreen ?? null,
    appTheme: snapshot.appTheme ?? null,
    appLocale: snapshot.appLocale ?? null,
    amazonStoreOverride: snapshot.amazonStoreOverride ?? null,
    translationOverrides: 'translationOverrides' in snapshot ? snapshot.translationOverrides ?? {} : {},
    activeBarId: 'activeBarId' in snapshot ? snapshot.activeBarId ?? null : null,
    onboardingStep: snapshot.onboardingStep ?? 1,
    onboardingCompleted: Boolean(snapshot.onboardingCompleted),
    onboardingStarterApplied: Boolean(snapshot.onboardingStarterApplied),
  });
}

async function persistCocktailTagDeltaInTransaction(
  migrationDb: MigrationDb,
  snapshot: CocktailTagDeltaSnapshot,
): Promise<void> {
  await runShapeCorrection(migrationDb);
  await migrationDb.execAsync('DELETE FROM cocktail_tag_delta;');

  for (const [cocktailId, value] of Object.entries(snapshot)) {
    await migrationDb.execAsync(
      `INSERT INTO cocktail_tag_delta(cocktail_id, payload_json, updated_at)
       VALUES (${JSON.stringify(cocktailId)}, ${value == null ? 'NULL' : JSON.stringify(toJson(value))}, datetime('now'))
       ON CONFLICT(cocktail_id) DO UPDATE SET payload_json=excluded.payload_json, updated_at=datetime('now');`,
    );
  }
}

async function loadSettingsMap(migrationDb: MigrationDb): Promise<Record<string, unknown>> {
  const rows = await migrationDb.getAllAsync<{ key: string; value_json: string | null }>('SELECT key, value_json FROM settings;');
  const map: Record<string, unknown> = {};
  for (const row of rows) {
    map[row.key] = parseJson(row.value_json, null);
  }

  return map;
}

async function loadInventorySnapshotFromSqlite<TCocktail, TIngredient>(
  migrationDb: MigrationDb,
): Promise<InventorySnapshot<TCocktail, TIngredient> | undefined> {
  await runShapeCorrection(migrationDb);

  const settings = await loadSettingsMap(migrationDb);
  if (typeof settings.legacy_snapshot === 'object' && settings.legacy_snapshot) {
    return settings.legacy_snapshot as InventorySnapshot<TCocktail, TIngredient>;
  }

  const cocktailRows = await migrationDb.getAllAsync<OverrideRow>(
    `SELECT entity_id, payload_json, source, deleted_at FROM user_entity_overrides WHERE entity_type='cocktail';`,
  );
  const ingredientRows = await migrationDb.getAllAsync<OverrideRow>(
    `SELECT entity_id, payload_json, source, deleted_at FROM user_entity_overrides WHERE entity_type='ingredient';`,
  );

  const toDelta = <TRecord>(rows: OverrideRow[]) => {
    const created: TRecord[] = [];
    const updated: TRecord[] = [];
    const deletedIds: number[] = [];

    rows.forEach((row) => {
      if (row.deleted_at) {
        deletedIds.push(row.entity_id);
        return;
      }

      const payload = parseJson<TRecord | null>(row.payload_json, null);
      if (!payload) {
        return;
      }

      if (row.source === 'created') {
        created.push(payload);
      } else {
        updated.push(payload);
      }
    });

    return {
      created: created.length > 0 ? created : undefined,
      updated: updated.length > 0 ? updated : undefined,
      deletedIds: deletedIds.length > 0 ? deletedIds : undefined,
    };
  };

  const customCocktailTags = await migrationDb.getAllAsync<{ id: number; name: string; color: string }>(
    `SELECT id, name, color FROM custom_cocktail_tags WHERE deleted_at IS NULL ORDER BY id ASC;`,
  );
  const customIngredientTags = await migrationDb.getAllAsync<{ id: number; name: string; color: string }>(
    `SELECT id, name, color FROM custom_ingredient_tags WHERE deleted_at IS NULL ORDER BY id ASC;`,
  );
  const availableRows = await migrationDb.getAllAsync<{ entity_id: number }>(
    `SELECT entity_id FROM list_membership WHERE list_name='available_ingredient_ids' AND entity_type='ingredient' ORDER BY entity_id ASC;`,
  );
  const shoppingRows = await migrationDb.getAllAsync<{ entity_id: number }>(
    `SELECT entity_id FROM list_membership WHERE list_name='shopping_ingredient_ids' AND entity_type='ingredient' ORDER BY entity_id ASC;`,
  );
  const feedbackRows = await migrationDb.getAllAsync<{ cocktail_key: string; rating: number | null; comment: string | null }>(
    `SELECT cocktail_key, rating, comment FROM cocktail_feedback;`,
  );
  const partyRows = await migrationDb.getAllAsync<{ cocktail_key: string }>(
    `SELECT cocktail_key FROM party_selection ORDER BY cocktail_key ASC;`,
  );
  const barRows = await migrationDb.getAllAsync<{ payload_json: string }>(
    `SELECT payload_json FROM bars WHERE deleted_at IS NULL ORDER BY updated_at ASC;`,
  );

  const cocktailRatings: Record<string, number> = {};
  const cocktailComments: Record<string, string> = {};
  feedbackRows.forEach((row) => {
    if (typeof row.rating === 'number') {
      cocktailRatings[row.cocktail_key] = row.rating;
    }
    if (typeof row.comment === 'string' && row.comment.trim()) {
      cocktailComments[row.cocktail_key] = row.comment;
    }
  });

  return {
    version: 3,
    imported: Boolean(settings.imported),
    delta: {
      cocktails: toDelta<TCocktail>(cocktailRows),
      ingredients: toDelta<TIngredient>(ingredientRows),
    },
    customCocktailTags,
    customIngredientTags,
    availableIngredientIds: availableRows.map((row) => row.entity_id),
    shoppingIngredientIds: shoppingRows.map((row) => row.entity_id),
    cocktailRatings,
    cocktailComments,
    partySelectedCocktailKeys: partyRows.map((row) => row.cocktail_key),
    ignoreGarnish: Boolean(settings.ignoreGarnish),
    allowAllSubstitutes: Boolean(settings.allowAllSubstitutes),
    useImperialUnits: Boolean(settings.useImperialUnits),
    keepScreenAwake: Boolean(settings.keepScreenAwake),
    shakerSmartFilteringEnabled: Boolean(settings.shakerSmartFilteringEnabled),
    showTabCounters: Boolean(settings.showTabCounters),
    ratingFilterThreshold: Number(settings.ratingFilterThreshold ?? 1),
    startScreen: typeof settings.startScreen === 'string' ? settings.startScreen : undefined,
    appTheme: typeof settings.appTheme === 'string' ? settings.appTheme : undefined,
    appLocale: typeof settings.appLocale === 'string' ? settings.appLocale : undefined,
    amazonStoreOverride: typeof settings.amazonStoreOverride === 'string' ? settings.amazonStoreOverride : null,
    translationOverrides: settings.translationOverrides,
    bars: barRows.map((row) => parseJson(row.payload_json, {})) as InventorySnapshot<TCocktail, TIngredient> extends { bars?: infer TBars } ? TBars : never,
    activeBarId: typeof settings.activeBarId === 'string' ? settings.activeBarId : undefined,
    onboardingStep: Number(settings.onboardingStep ?? 1),
    onboardingCompleted: Boolean(settings.onboardingCompleted),
    onboardingStarterApplied: Boolean(settings.onboardingStarterApplied),
  };
}

export const sqliteStorageAdapter: InventoryStorageAdapter = {
  async loadInventoryState<TCocktail, TIngredient>(): Promise<InventorySnapshot<TCocktail, TIngredient> | undefined> {
    return queue.run(async () => {
      await ensureInitialized();
      const db = await getDb();
      return runInTransaction(db, async (migrationDb) => {
        await maybeImportFromFileSnapshot(migrationDb);
        return loadInventorySnapshotFromSqlite<TCocktail, TIngredient>(migrationDb);
      });
    });
  },
  async saveInventoryState<TCocktail, TIngredient>(snapshot: InventorySnapshot<TCocktail, TIngredient>): Promise<void> {
    return queue.run(async () => {
      await ensureInitialized();
      const db = await getDb();
      await runInTransaction(db, async (migrationDb) => {
        await maybeImportFromFileSnapshot(migrationDb);
        await persistInventorySnapshotInTransaction(migrationDb, snapshot);
      });
    });
  },
  async loadCocktailTagDelta(): Promise<CocktailTagDeltaSnapshot> {
    return queue.run(async () => {
      await ensureInitialized();
      const db = await getDb();
      return runInTransaction(db, async (migrationDb) => {
        await maybeImportFromFileSnapshot(migrationDb);
        await runShapeCorrection(migrationDb);
        const rows = await migrationDb.getAllAsync<{ cocktail_id: string; payload_json: string | null }>(
          'SELECT cocktail_id, payload_json FROM cocktail_tag_delta;',
        );

        return rows.reduce<CocktailTagDeltaSnapshot>((acc, row) => {
          acc[row.cocktail_id] = parseJson(row.payload_json, null);
          return acc;
        }, {});
      });
    });
  },
  async saveCocktailTagDelta(snapshot: CocktailTagDeltaSnapshot): Promise<void> {
    return queue.run(async () => {
      await ensureInitialized();
      const db = await getDb();
      await runInTransaction(db, async (migrationDb) => {
        await maybeImportFromFileSnapshot(migrationDb);
        await persistCocktailTagDeltaInTransaction(migrationDb, snapshot);
      });
    });
  },
  async syncBundledCatalogIfNeeded(): Promise<void> {
    return queue.run(async () => {
      await ensureInitialized();
      const db = await getDb();
      await runInTransaction(db, async (migrationDb) => {
        await syncBundledCatalogIfNeededInTransaction(migrationDb);
      });
    });
  },
};
