import {
  CREATE_INDEX_STATEMENTS,
  CREATE_TABLE_STATEMENTS,
  REQUIRED_COLUMNS,
  SQLITE_SCHEMA_VERSION,
} from '@/libs/storage/sqlite/schema';

export type MigrationDb = {
  execAsync(sql: string): Promise<void>;
  getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null>;
};

type TableColumnInfo = {
  name: string;
};

async function getTableColumns(db: MigrationDb, tableName: string): Promise<Set<string>> {
  const rows = await db.getAllAsync<TableColumnInfo>(`PRAGMA table_info(${tableName});`);
  return new Set(rows.map((row) => row.name));
}

async function tableExists(db: MigrationDb, tableName: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=? LIMIT 1;`,
    tableName,
  );
  return Boolean(row?.name);
}

async function rebuildBarsTable(db: MigrationDb): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS bars_new (
      id TEXT PRIMARY KEY NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );
  `);

  const columns = await getTableColumns(db, 'bars');
  const hasPayload = columns.has('payload_json');
  const hasUpdated = columns.has('updated_at');
  const hasCreated = columns.has('created_at');
  const hasDeleted = columns.has('deleted_at');

  if (hasPayload) {
    await db.execAsync(`
      INSERT OR REPLACE INTO bars_new (id, payload_json, created_at, updated_at, deleted_at)
      SELECT
        id,
        payload_json,
        ${hasCreated ? 'created_at' : "datetime('now')"},
        ${hasUpdated ? 'updated_at' : "datetime('now')"},
        ${hasDeleted ? 'deleted_at' : 'NULL'}
      FROM bars;
    `);
  } else {
    await db.execAsync(`
      INSERT OR REPLACE INTO bars_new (id, payload_json, created_at, updated_at, deleted_at)
      SELECT
        id,
        json_object(
          'id', id,
          'name', COALESCE(name, ''),
          'availableIngredientIds', json('[]'),
          'shoppingIngredientIds', json('[]')
        ),
        ${hasCreated ? 'created_at' : "datetime('now')"},
        ${hasUpdated ? 'updated_at' : "datetime('now')"},
        ${hasDeleted ? 'deleted_at' : 'NULL'}
      FROM bars;
    `);
  }

  await db.execAsync('DROP TABLE bars;');
  await db.execAsync('ALTER TABLE bars_new RENAME TO bars;');
  console.info('[storage/sqlite] repaired bars table shape');
}

async function ensureColumns(db: MigrationDb, tableName: string, requiredColumns: readonly string[]): Promise<void> {
  if (!(await tableExists(db, tableName))) {
    return;
  }

  const columns = await getTableColumns(db, tableName);
  const missing = requiredColumns.filter((column) => !columns.has(column));
  if (missing.length === 0) {
    return;
  }

  if (tableName === 'bars') {
    await rebuildBarsTable(db);
    return;
  }

  for (const column of missing) {
    if (column === 'deleted_at') {
      await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN deleted_at TEXT;`);
    } else if (column === 'updated_at') {
      await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'));`);
    } else if (column === 'payload_json') {
      await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN payload_json TEXT;`);
      await db.execAsync(`UPDATE ${tableName} SET payload_json = COALESCE(payload_json, '{}');`);
    }
  }

  console.info(`[storage/sqlite] repaired ${tableName} columns: ${missing.join(', ')}`);
}

export async function migrateAndRepairSchema(db: MigrationDb): Promise<void> {
  const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  const beforeVersion = Number(versionRow?.user_version ?? 0);
  console.info(`[storage/sqlite] schema version before migration: ${beforeVersion}`);

  for (const statement of CREATE_TABLE_STATEMENTS) {
    await db.execAsync(statement);
  }
  for (const statement of CREATE_INDEX_STATEMENTS) {
    await db.execAsync(statement);
  }

  for (const [tableName, requiredColumns] of Object.entries(REQUIRED_COLUMNS)) {
    await ensureColumns(db, tableName, requiredColumns);
  }

  await db.execAsync(`PRAGMA user_version = ${SQLITE_SCHEMA_VERSION};`);
  console.info(`[storage/sqlite] schema version after migration: ${SQLITE_SCHEMA_VERSION}`);
}

export async function runShapeCorrection(db: MigrationDb): Promise<void> {
  for (const [tableName, requiredColumns] of Object.entries(REQUIRED_COLUMNS)) {
    await ensureColumns(db, tableName, requiredColumns);
  }
}
