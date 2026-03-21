const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

function loadTsModule(filePath, mocks = {}) {
  const source = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;

  const module = { exports: {} };
  const context = vm.createContext({
    module,
    exports: module.exports,
    require: (specifier) => {
      if (mocks[specifier]) {
        return mocks[specifier];
      }
      return require(specifier);
    },
    __dirname: path.dirname(filePath),
    __filename: filePath,
    console,
  });

  new vm.Script(transpiled, { filename: filePath }).runInContext(context);
  return module.exports;
}

test('ensureSqliteSchema rebuilds bars table when payload_json is missing', async () => {
  const execCalls = [];
  const db = {
    execAsync: async (sql) => {
      execCalls.push(sql);
    },
    getAllAsync: async (sql) => {
      if (sql === 'PRAGMA table_info(bars)') {
        return [{ name: 'id' }, { name: 'name' }, { name: 'updated_at' }];
      }
      if (sql.startsWith('PRAGMA table_info(')) {
        return [{ name: 'key' }, { name: 'value_json' }, { name: 'updated_at' }];
      }
      return [];
    },
    getFirstAsync: async () => ({ user_version: 0 }),
  };

  const mod = loadTsModule(path.resolve(__dirname, '../libs/storage/sqlite/migrations.ts'), {
    '@/libs/storage/sqlite/schema': {
      SQLITE_SCHEMA_VERSION: 2,
      TABLE_DEFINITIONS: {
        bars: 'CREATE TABLE IF NOT EXISTS bars (id TEXT PRIMARY KEY, payload_json TEXT NOT NULL, updated_at INTEGER NOT NULL)',
        app_state: 'CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at INTEGER NOT NULL)',
      },
      INDEX_DEFINITIONS: [],
    },
  });

  await mod.ensureSqliteSchema(db);
  const joined = execCalls.join('\n');

  assert.match(joined, /CREATE TABLE IF NOT EXISTS bars_new/);
  assert.match(joined, /DROP TABLE bars/);
  assert.match(joined, /ALTER TABLE bars_new RENAME TO bars/);
});

test('ensureBarsTableShape runs corrective rebuild outside full schema migration', async () => {
  const execCalls = [];
  const db = {
    execAsync: async (sql) => {
      execCalls.push(sql);
    },
    getAllAsync: async (sql) => {
      if (sql === 'PRAGMA table_info(bars)') {
        return [{ name: 'id' }, { name: 'name' }, { name: 'updated_at' }];
      }
      return [];
    },
  };

  const mod = loadTsModule(path.resolve(__dirname, '../libs/storage/sqlite/migrations.ts'), {
    '@/libs/storage/sqlite/schema': {
      SQLITE_SCHEMA_VERSION: 2,
      TABLE_DEFINITIONS: {
        bars: 'CREATE TABLE IF NOT EXISTS bars (id TEXT PRIMARY KEY, payload_json TEXT NOT NULL, updated_at INTEGER NOT NULL)',
      },
      INDEX_DEFINITIONS: [],
    },
  });

  await mod.ensureBarsTableShape(db);
  const joined = execCalls.join('\n');
  assert.match(joined, /ALTER TABLE bars_new RENAME TO bars/);
});

test('rebuildBarsTable handles legacy bars tables without updated_at column', async () => {
  const execCalls = [];
  const db = {
    execAsync: async (sql) => {
      execCalls.push(sql);
    },
    getAllAsync: async (sql) => {
      if (sql === 'PRAGMA table_info(bars)') {
        return [{ name: 'id' }, { name: 'name' }];
      }
      return [];
    },
  };

  const mod = loadTsModule(path.resolve(__dirname, '../libs/storage/sqlite/migrations.ts'), {
    '@/libs/storage/sqlite/schema': {
      SQLITE_SCHEMA_VERSION: 2,
      TABLE_DEFINITIONS: {
        bars: 'CREATE TABLE IF NOT EXISTS bars (id TEXT PRIMARY KEY, payload_json TEXT NOT NULL, updated_at INTEGER NOT NULL)',
      },
      INDEX_DEFINITIONS: [],
    },
  });

  await mod.rebuildBarsTable(db);
  const joined = execCalls.join('\n');
  assert.match(joined, /CAST\(strftime\('%s','now'\) AS INTEGER\)/);
});

test('ensureRuntimeColumnShape adds missing deleted_at columns', async () => {
  const execCalls = [];
  const db = {
    execAsync: async (sql) => {
      execCalls.push(sql);
    },
    getAllAsync: async (sql) => {
      if (sql === 'PRAGMA table_info(custom_cocktail_tags)') {
        return [{ name: 'id' }, { name: 'name' }, { name: 'color' }];
      }
      if (sql === 'PRAGMA table_info(custom_ingredient_tags)') {
        return [{ name: 'id' }, { name: 'name' }, { name: 'color' }];
      }
      if (sql === 'PRAGMA table_info(user_entity_overrides)') {
        return [{ name: 'entity_type' }, { name: 'entity_id' }, { name: 'payload_json' }];
      }
      return [];
    },
  };

  const mod = loadTsModule(path.resolve(__dirname, '../libs/storage/sqlite/migrations.ts'), {
    '@/libs/storage/sqlite/schema': {
      SQLITE_SCHEMA_VERSION: 2,
      TABLE_DEFINITIONS: {},
      INDEX_DEFINITIONS: [],
    },
  });

  await mod.ensureRuntimeColumnShape(db);
  const joined = execCalls.join('\n');
  assert.match(joined, /ALTER TABLE custom_cocktail_tags ADD COLUMN deleted_at INTEGER NULL/);
  assert.match(joined, /ALTER TABLE custom_ingredient_tags ADD COLUMN deleted_at INTEGER NULL/);
  assert.match(joined, /ALTER TABLE user_entity_overrides ADD COLUMN deleted_at INTEGER NULL/);
});
