const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

function loadAdapterModule(stubs, env = {}) {
  const filePath = path.resolve(__dirname, '../libs/inventory-storage-adapter.ts');
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
    process: { env },
    console,
    require: (specifier) => {
      if (specifier in stubs) {
        return stubs[specifier];
      }
      throw new Error(`Missing stub for ${specifier}`);
    },
    __dirname: path.dirname(filePath),
    __filename: filePath,
    setTimeout,
    clearTimeout,
  });

  new vm.Script(transpiled, { filename: filePath }).runInContext(context);
  return module.exports;
}

function createFakeDb({ failOnRun = null } = {}) {
  const commands = [];
  const state = {
    cocktails: [],
    ingredients: [],
    meta: new Map(),
  };

  return {
    commands,
    state,
    async execAsync(sql) {
      commands.push(sql.trim());
    },
    async runAsync(sql, ...params) {
      commands.push(sql.trim());
      if (failOnRun && sql.includes(failOnRun)) {
        throw new Error('forced write failure');
      }

      if (sql.startsWith('DELETE FROM cocktails')) state.cocktails = [];
      if (sql.startsWith('DELETE FROM ingredients')) state.ingredients = [];
      if (sql.startsWith('INSERT OR REPLACE INTO storage_meta')) {
        state.meta.set(params[0], params[1]);
      }
      if (sql.startsWith('INSERT INTO cocktails')) {
        state.cocktails.push({ entity_id: params[0], data: params[2] });
      }
      if (sql.startsWith('INSERT INTO ingredients')) {
        state.ingredients.push({ entity_id: params[0], data: params[2] });
      }
    },
    async getFirstAsync(sql) {
      if (sql.includes('COUNT(*) as count FROM cocktails')) {
        return { count: state.cocktails.length };
      }
      if (sql.includes('snapshot_version')) {
        return { value: state.meta.get('snapshot_version') ?? '3' };
      }
      if (sql.includes('active_bar_id')) {
        return { value: state.meta.get('active_bar_id') ?? '' };
      }
      return null;
    },
    async getAllAsync(sql) {
      if (sql.includes('FROM cocktails')) return state.cocktails.map((row) => ({ ...row, search_name_normalized: null }));
      if (sql.includes('FROM ingredients')) return state.ingredients.map((row) => ({ ...row, search_name_normalized: null }));
      return [];
    },
  };
}

test('sqlite adapter rollbacks transaction when delta persist fails', async () => {
  let storedSnapshot;
  const fakeDb = createFakeDb({ failOnRun: 'ingredients' });
  const module = loadAdapterModule({
    'expo-file-system/legacy': {
      documentDirectory: '/tmp',
      cacheDirectory: '/tmp',
      getInfoAsync: async () => ({ exists: true }),
      writeAsStringAsync: async () => {},
    },
    '@/libs/inventory-storage': {
      loadInventorySnapshot: async () => storedSnapshot,
      persistInventorySnapshot: async (snapshot) => { storedSnapshot = snapshot; },
    },
    '@/providers/inventory-types': {},
  });

  const { SqliteInventoryStorageAdapter } = module.__internal();
  const adapter = new SqliteInventoryStorageAdapter({
    openDatabaseAsync: async () => fakeDb,
  });

  await assert.rejects(() => adapter.persistStateDelta({
    version: 3,
    delta: {
      cocktails: { created: [{ id: 1, name: 'A' }] },
      ingredients: { created: [{ id: 10, name: 'Gin' }] },
    },
  }));

  assert.ok(fakeDb.commands.includes('ROLLBACK;'));
});

test('migration from JSON snapshot runs once and exports compatible v3 snapshot', async () => {
  let markerExists = false;
  let jsonSnapshot = {
    version: 3,
    delta: {
      cocktails: { created: [{ id: 1, name: 'Negroni' }] },
      ingredients: { created: [{ id: 10, name: 'Gin' }] },
    },
    partySelectedCocktailKeys: ['1'],
  };

  const fakeDb = createFakeDb();
  const module = loadAdapterModule({
    'expo-file-system/legacy': {
      documentDirectory: '/tmp',
      cacheDirectory: '/tmp',
      getInfoAsync: async () => ({ exists: markerExists }),
      writeAsStringAsync: async () => { markerExists = true; },
    },
    '@/libs/inventory-storage': {
      loadInventorySnapshot: async () => jsonSnapshot,
      persistInventorySnapshot: async () => {},
    },
    '@/providers/inventory-types': {},
  });

  const { SqliteInventoryStorageAdapter } = module.__internal();
  const adapter = new SqliteInventoryStorageAdapter({
    openDatabaseAsync: async () => fakeDb,
  });

  const firstLoad = await adapter.loadState();
  assert.equal(firstLoad.version, 3);
  assert.ok(markerExists);

  jsonSnapshot = undefined;
  const secondLoad = await adapter.loadState();
  assert.equal(secondLoad.version, 3);
});

test('feature flag disabled keeps JSON fallback adapter', async () => {
  let persisted;
  const module = loadAdapterModule({
    'expo-file-system/legacy': {
      documentDirectory: '/tmp',
      cacheDirectory: '/tmp',
      getInfoAsync: async () => ({ exists: false }),
      writeAsStringAsync: async () => {},
    },
    '@/libs/inventory-storage': {
      loadInventorySnapshot: async () => ({ version: 3, delta: {} }),
      persistInventorySnapshot: async (snapshot) => { persisted = snapshot; },
    },
    '@/providers/inventory-types': {},
  }, {
    EXPO_PUBLIC_USE_SQLITE_STORAGE: '0',
  });

  const adapter = await module.getInventoryStorageAdapter();
  await adapter.persistStateDelta({ version: 3, delta: {} });
  assert.deepEqual(persisted, { version: 3, delta: {} });
});
