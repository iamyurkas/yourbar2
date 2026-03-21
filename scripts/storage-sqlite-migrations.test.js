const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

function loadTsModule(filePath, stubs = {}) {
  const source = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;

  const module = { exports: {} };
  const localRequire = (specifier) => {
    if (stubs[specifier]) {
      return stubs[specifier];
    }
    if (specifier.startsWith('@/')) {
      const resolved = path.resolve(__dirname, '..', `${specifier.slice(2)}.ts`);
      return loadTsModule(resolved, stubs);
    }
    return require(specifier);
  };

  const context = vm.createContext({
    module,
    exports: module.exports,
    require: localRequire,
    __dirname: path.dirname(filePath),
    __filename: filePath,
    console,
    process,
  });

  new vm.Script(transpiled, { filename: filePath }).runInContext(context);
  return module.exports;
}

class FakeDb {
  constructor(columnsByTable) {
    this.columnsByTable = columnsByTable;
    this.execLog = [];
  }

  async execAsync(sql) {
    this.execLog.push(sql);
  }

  async getAllAsync(sql) {
    const match = sql.match(/PRAGMA table_info\(([^)]+)\)/);
    if (match) {
      const table = match[1];
      return (this.columnsByTable[table] || []).map((name) => ({ name }));
    }
    return [];
  }

  async getFirstAsync(sql, tableName) {
    if (sql.includes('PRAGMA user_version')) {
      return { user_version: 0 };
    }
    if (sql.includes("sqlite_master") && tableName) {
      return this.columnsByTable[tableName] ? { name: tableName } : null;
    }
    return null;
  }
}

const migrations = loadTsModule(path.resolve(__dirname, '../libs/storage/sqlite/migrations.ts'));

test('runShapeCorrection repairs missing bars payload_json and updated_at via rebuild', async () => {
  const db = new FakeDb({ bars: ['id', 'name'] });
  await migrations.runShapeCorrection(db);

  assert.equal(db.execLog.some((sql) => sql.includes('bars_new')), true);
  assert.equal(db.execLog.some((sql) => sql.includes('DROP TABLE bars')), true);
});

test('runShapeCorrection adds deleted_at to custom tag tables and overrides', async () => {
  const db = new FakeDb({
    custom_cocktail_tags: ['id', 'name', 'color'],
    custom_ingredient_tags: ['id', 'name', 'color', 'updated_at'],
    user_entity_overrides: ['entity_type', 'entity_id', 'payload_json'],
  });

  await migrations.runShapeCorrection(db);

  const joined = db.execLog.join('\n');
  assert.equal(joined.includes('ALTER TABLE custom_cocktail_tags ADD COLUMN deleted_at TEXT;'), true);
  assert.equal(joined.includes('ALTER TABLE custom_ingredient_tags ADD COLUMN deleted_at TEXT;'), true);
  assert.equal(joined.includes('ALTER TABLE user_entity_overrides ADD COLUMN deleted_at TEXT;'), true);
});
