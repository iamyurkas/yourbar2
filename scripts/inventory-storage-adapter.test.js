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

function createFakeDb({ failOnRun = null, failOnNullBarStateId = false, legacyBarStateSchema = false } = {}) {
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
      if (failOnNullBarStateId && sql.startsWith('INSERT INTO bar_state') && (params[0] == null || params[0] === '')) {
        throw new Error('bar_state.bar_id must be non-empty');
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
      if (sql.includes('PRAGMA table_info(bar_state)')) {
        if (legacyBarStateSchema) {
          return [
            { name: 'bar_id', notnull: 1 },
            { name: 'ingredient_id', notnull: 1 },
            { name: 'is_available', notnull: 0 },
            { name: 'is_shopping', notnull: 0 },
          ];
        }

        return [
          { name: 'bar_id', notnull: 1 },
          { name: 'available_ingredient_ids', notnull: 1 },
          { name: 'shopping_ingredient_ids', notnull: 1 },
        ];
      }
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

test('schema bootstrap deduplicates bar_state keys before unique index creation', async () => {
  const fakeDb = createFakeDb();
  const module = loadAdapterModule({
    'expo-file-system/legacy': {
      documentDirectory: '/tmp',
      cacheDirectory: '/tmp',
      getInfoAsync: async () => ({ exists: true }),
      writeAsStringAsync: async () => {},
    },
    '@/libs/inventory-storage': {
      loadInventorySnapshot: async () => undefined,
      persistInventorySnapshot: async () => {},
    },
    '@/providers/inventory-types': {},
  });

  const { SqliteInventoryStorageAdapter } = module.__internal();
  const adapter = new SqliteInventoryStorageAdapter({
    openDatabaseAsync: async () => fakeDb,
  });

  await adapter.persistStateDelta({ version: 3, delta: {} });
  assert.ok(
    fakeDb.commands.some((command) => command.includes('DELETE FROM bar_state') && command.includes('GROUP BY bar_id')),
  );
  assert.ok(
    fakeDb.commands.some((command) => command.includes('PRAGMA synchronous = NORMAL')),
  );
});

test('persistBars skips invalid bar ids to avoid NOT NULL bar_state failures', async () => {
  const fakeDb = createFakeDb({ failOnNullBarStateId: true });
  const module = loadAdapterModule({
    'expo-file-system/legacy': {
      documentDirectory: '/tmp',
      cacheDirectory: '/tmp',
      getInfoAsync: async () => ({ exists: true }),
      writeAsStringAsync: async () => {},
    },
    '@/libs/inventory-storage': {
      loadInventorySnapshot: async () => undefined,
      persistInventorySnapshot: async () => {},
    },
    '@/providers/inventory-types': {},
  });

  const { SqliteInventoryStorageAdapter } = module.__internal();
  const adapter = new SqliteInventoryStorageAdapter({
    openDatabaseAsync: async () => fakeDb,
  });

  await assert.doesNotReject(() => adapter.persistStateDelta({
    version: 3,
    delta: {},
    bars: [
      { id: '', name: 'Bad', availableIngredientIds: [], shoppingIngredientIds: [] },
      { id: 'bar-1', name: 'Primary', availableIngredientIds: [], shoppingIngredientIds: [] },
    ],
    activeBarId: '',
  }));
});

test('schema bootstrap migrates legacy bar_state schema with ingredient_id rows', async () => {
  const fakeDb = createFakeDb({ legacyBarStateSchema: true });
  const module = loadAdapterModule({
    'expo-file-system/legacy': {
      documentDirectory: '/tmp',
      cacheDirectory: '/tmp',
      getInfoAsync: async () => ({ exists: true }),
      writeAsStringAsync: async () => {},
    },
    '@/libs/inventory-storage': {
      loadInventorySnapshot: async () => undefined,
      persistInventorySnapshot: async () => {},
    },
    '@/providers/inventory-types': {},
  });

  const { SqliteInventoryStorageAdapter } = module.__internal();
  const adapter = new SqliteInventoryStorageAdapter({
    openDatabaseAsync: async () => fakeDb,
  });

  await assert.doesNotReject(() => adapter.persistStateDelta({
    version: 3,
    delta: {},
    bars: [
      { id: 'bar-1', name: 'Primary', availableIngredientIds: [1, 2], shoppingIngredientIds: [3] },
    ],
    activeBarId: 'bar-1',
  }));

  assert.ok(
    fakeDb.commands.some((command) => command.includes('DROP TABLE bar_state') && command.includes('RENAME TO bar_state')),
  );
});
