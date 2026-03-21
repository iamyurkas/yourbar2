export const SQLITE_DB_NAME = 'inventory-state.db';
export const SQLITE_SCHEMA_VERSION = 4;

export const REQUIRED_COLUMNS: Record<string, string[]> = {
  bars: ['id', 'payload_json', 'updated_at'],
  custom_cocktail_tags: ['id', 'name', 'color', 'deleted_at', 'updated_at'],
  custom_ingredient_tags: ['id', 'name', 'color', 'deleted_at', 'updated_at'],
  user_entity_overrides: ['entity_type', 'entity_id', 'payload_json', 'deleted_at', 'updated_at'],
};

export const CREATE_TABLE_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY NOT NULL,
    value_json TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,
  `CREATE TABLE IF NOT EXISTS import_markers (
    name TEXT PRIMARY KEY NOT NULL,
    completed_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,
  `CREATE TABLE IF NOT EXISTS catalog_meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,
  `CREATE TABLE IF NOT EXISTS catalog_cocktails (
    id INTEGER PRIMARY KEY NOT NULL,
    payload_json TEXT NOT NULL,
    revision TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,
  `CREATE TABLE IF NOT EXISTS catalog_ingredients (
    id INTEGER PRIMARY KEY NOT NULL,
    payload_json TEXT NOT NULL,
    revision TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,
  `CREATE TABLE IF NOT EXISTS user_entity_overrides (
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    payload_json TEXT,
    source TEXT,
    deleted_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY(entity_type, entity_id)
  );`,
  `CREATE TABLE IF NOT EXISTS bars (
    id TEXT PRIMARY KEY NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS custom_cocktail_tags (
    id INTEGER PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS custom_ingredient_tags (
    id INTEGER PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value_json TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,
  `CREATE TABLE IF NOT EXISTS list_membership (
    list_name TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY(list_name, entity_type, entity_id)
  );`,
  `CREATE TABLE IF NOT EXISTS cocktail_feedback (
    cocktail_key TEXT PRIMARY KEY NOT NULL,
    rating INTEGER,
    comment TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,
  `CREATE TABLE IF NOT EXISTS party_selection (
    cocktail_key TEXT PRIMARY KEY NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,
  `CREATE TABLE IF NOT EXISTS cocktail_tag_delta (
    cocktail_id TEXT PRIMARY KEY NOT NULL,
    payload_json TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,
];

export const CREATE_INDEX_STATEMENTS: string[] = [
  `CREATE INDEX IF NOT EXISTS idx_user_entity_overrides_type_deleted
   ON user_entity_overrides(entity_type, deleted_at);`,
  `CREATE INDEX IF NOT EXISTS idx_list_membership_lookup
   ON list_membership(list_name, entity_type);`,
  `CREATE INDEX IF NOT EXISTS idx_bars_deleted ON bars(deleted_at);`,
];
