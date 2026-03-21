const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

class InMemoryDb {
  constructor() {
    this.tables = {
      cocktails: new Map(),
      ingredients: new Map(),
      tags: new Map(),
      settings: new Map(),
      bars: new Map(),
      bar_state: new Map(),
      feedback: new Map(),
      party_selection: new Set(),
      translation_overrides: new Map(),
      metadata: new Map(),
    };
    this.execLog = [];
    this.failOnInsertInto = null;
  }

  async execAsync(sql) {
    this.execLog.push(sql);
    if (sql.includes('DELETE FROM cocktails')) this.tables.cocktails.clear();
    if (sql.includes('DELETE FROM ingredients')) this.tables.ingredients.clear();
    if (sql.includes('DELETE FROM tags')) this.tables.tags.clear();
    if (sql.includes('DELETE FROM settings')) this.tables.settings.clear();
    if (sql.includes('DELETE FROM bars')) this.tables.bars.clear();
    if (sql.includes('DELETE FROM bar_state')) this.tables.bar_state.clear();
    if (sql.includes('DELETE FROM feedback')) this.tables.feedback.clear();
    if (sql.includes('DELETE FROM party_selection')) this.tables.party_selection.clear();
    if (sql.includes('DELETE FROM translation_overrides')) this.tables.translation_overrides.clear();
    if (sql.includes('DELETE FROM metadata')) this.tables.metadata.clear();
  }

  async runAsync(sql, params = []) {
    if (this.failOnInsertInto && sql.includes(this.failOnInsertInto)) {
      throw new Error('forced failure');
    }
    if (sql.includes('INSERT OR REPLACE INTO cocktails')) this.tables.cocktails.set(Number(params[0]), JSON.parse(params[1]));
    else if (sql.includes('DELETE FROM cocktails WHERE id')) this.tables.cocktails.delete(Number(params[0]));
    else if (sql.includes('INSERT OR REPLACE INTO ingredients')) this.tables.ingredients.set(Number(params[0]), JSON.parse(params[1]));
    else if (sql.includes('DELETE FROM ingredients WHERE id')) this.tables.ingredients.delete(Number(params[0]));
    else if (sql.includes('INSERT OR REPLACE INTO metadata')) this.tables.metadata.set(String(params[0]), String(params[1]));
    else if (sql.includes('INSERT OR REPLACE INTO settings')) this.tables.settings.set(String(params[0]), String(params[1]));
    else if (sql.includes('INSERT OR REPLACE INTO tags')) this.tables.tags.set(`${params[0]}:${params[1]}`, { kind: params[0], id: params[1], name: params[2], color: params[3] });
    else if (sql.includes('INSERT OR REPLACE INTO feedback')) this.tables.feedback.set(String(params[0]), { rating: params[1], comment: params[2] });
    else if (sql.includes('INSERT OR REPLACE INTO party_selection')) this.tables.party_selection.add(String(params[0]));
    else if (sql.includes('INSERT OR REPLACE INTO bars')) this.tables.bars.set(String(params[0]), { id: String(params[0]), name: String(params[1]) });
    else if (sql.includes('INSERT OR REPLACE INTO bar_state')) this.tables.bar_state.set(`${params[0]}:${params[1]}`, { bar_id: String(params[0]), ingredient_id: Number(params[1]), available: Number(params[2]), shopping: Number(params[3]) });
    else if (sql.includes('INSERT OR REPLACE INTO translation_overrides')) this.tables.translation_overrides.set(String(params[0]), String(params[1]));
  }

  async getFirstAsync(sql, params = []) {
    if (sql.includes('FROM metadata')) {
      const key = String(params[0]);
      const value = this.tables.metadata.get(key);
      return value == null ? null : { value_json: value };
    }
    if (sql.includes('FROM settings')) {
      const key = String(params[0]);
      const value = this.tables.settings.get(key);
      return value == null ? null : { value_json: value };
    }
    if (sql.includes('SELECT id FROM cocktails')) {
      const first = this.tables.cocktails.keys().next();
      return first.done ? null : { id: first.value };
    }
    if (sql.includes('SELECT id FROM ingredients')) {
      const first = this.tables.ingredients.keys().next();
      return first.done ? null : { id: first.value };
    }
    return null;
  }

  async getAllAsync(sql) {
    if (sql.includes('FROM tags')) return Array.from(this.tables.tags.values());
    if (sql.includes('FROM settings')) {
      return Array.from(this.tables.settings.entries())
        .filter(([key]) => key !== 'delta')
        .map(([key, value_json]) => ({ key, value_json }));
    }
    if (sql.includes('FROM feedback')) return Array.from(this.tables.feedback.entries()).map(([cocktail_key, value]) => ({ cocktail_key, rating: value.rating, comment: value.comment }));
    if (sql.includes('FROM party_selection')) return Array.from(this.tables.party_selection.values()).sort().map((cocktail_key) => ({ cocktail_key }));
    if (sql.includes('FROM bars')) return Array.from(this.tables.bars.values());
    if (sql.includes('FROM bar_state')) return Array.from(this.tables.bar_state.values());
    if (sql.includes('FROM translation_overrides')) return Array.from(this.tables.translation_overrides.entries()).map(([locale, data_json]) => ({ locale, data_json }));
    return [];
  }
}

function loadSqliteAdapterModule() {
  const filePath = path.resolve(__dirname, '../libs/inventory-storage-sqlite-adapter.ts');
  const source = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;

  class JsonInventoryStorageAdapterMock {
    static loadCalls = 0;
    async loadState() { JsonInventoryStorageAdapterMock.loadCalls += 1; return undefined; }
    async persistStateDelta() {}
    async replaceState() {}
    async clearState() {}
    async exportSnapshot() { return undefined; }
    async importSnapshot() {}
  }

  const module = { exports: {} };
  const context = vm.createContext({
    module,
    exports: module.exports,
    require: (specifier) => {
      if (specifier === '@/libs/inventory-storage-adapter') {
        return { JsonInventoryStorageAdapter: JsonInventoryStorageAdapterMock };
      }
      return require(specifier);
    },
    __dirname: path.dirname(filePath),
    __filename: filePath,
  });

  new vm.Script(transpiled, { filename: filePath }).runInContext(context);
  return { exports: module.exports, JsonInventoryStorageAdapterMock };
}

function buildSnapshot() {
  return {
    version: 3,
    imported: true,
    delta: {
      cocktails: { created: [{ id: 9001, name: 'Test', searchNameNormalized: 'test' }] },
      ingredients: { created: [{ id: 7001, name: 'Gin', searchNameNormalized: 'gin' }] },
    },
    cocktailRatings: { '9001': 4 },
    cocktailComments: { '9001': 'ok' },
    partySelectedCocktailKeys: ['9001'],
    customCocktailTags: [{ id: 1, name: 'Tag', color: '#fff' }],
    customIngredientTags: [{ id: 2, name: 'I-Tag', color: '#000' }],
    bars: [{ id: '1', name: 'Main', availableIngredientIds: [7001], shoppingIngredientIds: [] }],
    translationOverrides: { 'en-US': { cocktails: { '9001': { name: 'Localized' } } } },
  };
}

test('persist/export keeps snapshot-compatible structures including party selection', async () => {
  const { exports } = loadSqliteAdapterModule();
  const db = new InMemoryDb();
  const adapter = new exports.SqliteInventoryStorageAdapter(async () => db);

  await adapter.persistStateDelta(buildSnapshot());
  const exported = await adapter.exportSnapshot();

  assert.equal(exported.version, 3);
  assert.equal(JSON.stringify(exported.partySelectedCocktailKeys), JSON.stringify(['9001']));
  assert.equal(exported.delta.cocktails.created[0].id, 9001);
});

test('transaction rollback is triggered on persist failures', async () => {
  const { exports } = loadSqliteAdapterModule();
  const db = new InMemoryDb();
  db.failOnInsertInto = 'INSERT OR REPLACE INTO feedback';
  const adapter = new exports.SqliteInventoryStorageAdapter(async () => db);

  await adapter.persistStateDelta(buildSnapshot());

  assert.ok(db.execLog.some((entry) => entry.includes('ROLLBACK')));
});

test('JSON migration is idempotent when migration flag already exists', async () => {
  const { exports, JsonInventoryStorageAdapterMock } = loadSqliteAdapterModule();
  const db = new InMemoryDb();
  db.tables.metadata.set('json_snapshot_migrated', 'true');
  const adapter = new exports.SqliteInventoryStorageAdapter(async () => db);

  await adapter.loadState();
  await adapter.loadState();

  assert.equal(JsonInventoryStorageAdapterMock.loadCalls, 0);
});
