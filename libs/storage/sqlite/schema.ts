export const SQLITE_DB_NAME = 'inventory-state.db';
export const SQLITE_SCHEMA_VERSION = 2;

export const TABLE_DEFINITIONS: Record<string, string> = {
  schema_meta: `CREATE TABLE IF NOT EXISTS schema_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  bars: `CREATE TABLE IF NOT EXISTS bars (
    id TEXT PRIMARY KEY,
    payload_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  app_state: `CREATE TABLE IF NOT EXISTS app_state (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  custom_cocktail_tags: `CREATE TABLE IF NOT EXISTS custom_cocktail_tags (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER NULL
  )`,
  custom_ingredient_tags: `CREATE TABLE IF NOT EXISTS custom_ingredient_tags (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER NULL
  )`,
  cocktail_tag_delta: `CREATE TABLE IF NOT EXISTS cocktail_tag_delta (
    cocktail_key TEXT PRIMARY KEY,
    payload_json TEXT NULL,
    updated_at INTEGER NOT NULL
  )`,
  ingredient_flags: `CREATE TABLE IF NOT EXISTS ingredient_flags (
    ingredient_id INTEGER PRIMARY KEY,
    is_available INTEGER NOT NULL DEFAULT 0,
    is_shopping INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  )`,
  cocktail_ratings: `CREATE TABLE IF NOT EXISTS cocktail_ratings (
    cocktail_key TEXT PRIMARY KEY,
    rating REAL NULL,
    comment TEXT NULL,
    updated_at INTEGER NOT NULL
  )`,
  catalog_entities: `CREATE TABLE IF NOT EXISTS catalog_entities (
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    payload_json TEXT NOT NULL,
    catalog_revision TEXT NOT NULL,
    PRIMARY KEY(entity_type, entity_id)
  )`,
  user_entity_overrides: `CREATE TABLE IF NOT EXISTS user_entity_overrides (
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    payload_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER NULL,
    PRIMARY KEY(entity_type, entity_id)
  )`,
};

export const INDEX_DEFINITIONS: string[] = [
  'CREATE INDEX IF NOT EXISTS idx_catalog_entities_type ON catalog_entities(entity_type)',
  'CREATE INDEX IF NOT EXISTS idx_user_entity_overrides_type_deleted ON user_entity_overrides(entity_type, deleted_at)',
  'CREATE INDEX IF NOT EXISTS idx_ingredient_flags_available_shopping ON ingredient_flags(is_available, is_shopping)',
  'CREATE INDEX IF NOT EXISTS idx_cocktail_ratings_updated_at ON cocktail_ratings(updated_at)',
];

export const APP_STATE_KEYS = {
  imported: 'imported',
  partySelectedCocktailKeys: 'partySelectedCocktailKeys',
  ignoreGarnish: 'ignoreGarnish',
  allowAllSubstitutes: 'allowAllSubstitutes',
  useImperialUnits: 'useImperialUnits',
  keepScreenAwake: 'keepScreenAwake',
  shakerSmartFilteringEnabled: 'shakerSmartFilteringEnabled',
  showTabCounters: 'showTabCounters',
  ratingFilterThreshold: 'ratingFilterThreshold',
  startScreen: 'startScreen',
  appTheme: 'appTheme',
  appLocale: 'appLocale',
  amazonStoreOverride: 'amazonStoreOverride',
  onboardingStep: 'onboardingStep',
  onboardingCompleted: 'onboardingCompleted',
  onboardingStarterApplied: 'onboardingStarterApplied',
  translationOverrides: 'translationOverrides',
  activeBarId: 'activeBarId',
  fileImportCompleted: 'fileImportCompleted',
  catalogRevision: 'catalogRevision',
} as const;
