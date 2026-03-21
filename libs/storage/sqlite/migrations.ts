import type { SQLiteDatabase } from 'expo-sqlite';

import { INDEX_DEFINITIONS, SQLITE_SCHEMA_VERSION, TABLE_DEFINITIONS } from '@/libs/storage/sqlite/schema';

type TableColumn = { name: string };

async function getTableColumns(db: SQLiteDatabase, tableName: string): Promise<Set<string>> {
  try {
    const columns = await db.getAllAsync<TableColumn>(`PRAGMA table_info(${tableName})`);
    return new Set(columns.map((column: TableColumn) => column.name));
  } catch {
    return new Set();
  }
}

async function tableHasRequiredColumns(
  db: SQLiteDatabase,
  tableName: string,
  requiredColumns: string[],
): Promise<boolean> {
  const columns = await getTableColumns(db, tableName);
  return requiredColumns.every((column) => columns.has(column));
}

export async function rebuildBarsTable(db: SQLiteDatabase): Promise<void> {
  console.info('[sqlite] Rebuilding bars table to ensure payload_json column exists');
  const existingColumns = await getTableColumns(db, 'bars');
  const hasPayload = existingColumns.has('payload_json');
  const hasName = existingColumns.has('name');

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS bars_new (
      id TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  if (hasPayload) {
    await db.execAsync(`
      INSERT INTO bars_new(id, payload_json, updated_at)
      SELECT
        CAST(id AS TEXT),
        payload_json,
        COALESCE(updated_at, CAST(strftime('%s','now') AS INTEGER))
      FROM bars;
    `);
  } else if (hasName) {
    await db.execAsync(`
      INSERT INTO bars_new(id, payload_json, updated_at)
      SELECT
        CAST(id AS TEXT),
        json_object(
          'id', CAST(id AS TEXT),
          'name', COALESCE(name, 'My Bar'),
          'availableIngredientIds', '[]',
          'shoppingIngredientIds', '[]'
        ),
        COALESCE(updated_at, CAST(strftime('%s','now') AS INTEGER))
      FROM bars;
    `);
  }

  await db.execAsync('DROP TABLE bars;');
  await db.execAsync('ALTER TABLE bars_new RENAME TO bars;');
}

async function applyBaseSchema(db: SQLiteDatabase): Promise<void> {
  for (const statement of Object.values(TABLE_DEFINITIONS)) {
    await db.execAsync(`${statement};`);
  }

  for (const statement of INDEX_DEFINITIONS) {
    await db.execAsync(`${statement};`);
  }
}

export async function ensureSqliteSchema(db: SQLiteDatabase): Promise<void> {
  const beforeVersionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const beforeVersion = beforeVersionRow?.user_version ?? 0;
  console.info(`[sqlite] schema version before migration: ${beforeVersion}`);

  await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
  try {
    await applyBaseSchema(db);

    const barsColumnsOk = await tableHasRequiredColumns(db, 'bars', ['id', 'payload_json', 'updated_at']);
    if (!barsColumnsOk) {
      const barsExists = (await getTableColumns(db, 'bars')).size > 0;
      if (barsExists) {
        await rebuildBarsTable(db);
      } else {
        await db.execAsync(`${TABLE_DEFINITIONS.bars};`);
      }
    }

    const appStateColumnsOk = await tableHasRequiredColumns(db, 'app_state', ['key', 'value_json', 'updated_at']);
    if (!appStateColumnsOk) {
      await db.execAsync('DROP TABLE IF EXISTS app_state;');
      await db.execAsync(`${TABLE_DEFINITIONS.app_state};`);
    }

    await db.execAsync(`PRAGMA user_version = ${SQLITE_SCHEMA_VERSION}`);
    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    console.error('[sqlite] schema migration failed', error);
    throw error;
  }

  const afterVersionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const afterVersion = afterVersionRow?.user_version ?? 0;
  console.info(`[sqlite] schema version after migration: ${afterVersion}`);
}

export async function hasColumn(db: SQLiteDatabase, tableName: string, columnName: string): Promise<boolean> {
  const columns = await getTableColumns(db, tableName);
  return columns.has(columnName);
}

export async function ensureBarsTableShape(db: SQLiteDatabase): Promise<void> {
  const barsColumnsOk = await tableHasRequiredColumns(db, 'bars', ['id', 'payload_json', 'updated_at']);
  if (barsColumnsOk) {
    return;
  }

  const barsExists = (await getTableColumns(db, 'bars')).size > 0;
  if (!barsExists) {
    await db.execAsync(`${TABLE_DEFINITIONS.bars};`);
    return;
  }

  await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
  try {
    await rebuildBarsTable(db);
    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}
