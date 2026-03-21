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
    process,
  });

  new vm.Script(transpiled, { filename: filePath }).runInContext(context);
  return module.exports;
}

test('storage adapter selection follows EXPO_PUBLIC_USE_SQLITE_STORAGE flag', async () => {
  const calls = [];
  const fileAdapter = {
    loadInventorySnapshot: async () => {
      calls.push('file-load');
      return { version: 3 };
    },
    persistInventorySnapshot: async () => calls.push('file-save'),
    loadCocktailTagDeltaSnapshot: async () => ({}),
    persistCocktailTagDeltaSnapshot: async () => undefined,
    syncBundledCatalogIfNeeded: async () => undefined,
  };

  const sqliteAdapter = {
    loadInventorySnapshot: async () => {
      calls.push('sqlite-load');
      return { version: 3 };
    },
    persistInventorySnapshot: async () => calls.push('sqlite-save'),
    loadCocktailTagDeltaSnapshot: async () => ({}),
    persistCocktailTagDeltaSnapshot: async () => undefined,
    syncBundledCatalogIfNeeded: async () => undefined,
  };

  const modulePath = path.resolve(__dirname, '../libs/storage/index.ts');

  process.env.EXPO_PUBLIC_USE_SQLITE_STORAGE = 'false';
  let mod = loadTsModule(modulePath, {
    '@/libs/storage/file-storage': { fileStorageAdapter: fileAdapter },
    '@/libs/storage/sqlite-storage': { __esModule: true, default: sqliteAdapter },
    '@/libs/storage/types': {},
  });

  await mod.loadInventoryState();
  assert.deepEqual(calls, ['file-load']);

  calls.length = 0;
  process.env.EXPO_PUBLIC_USE_SQLITE_STORAGE = 'true';
  mod = loadTsModule(modulePath, {
    '@/libs/storage/file-storage': { fileStorageAdapter: fileAdapter },
    '@/libs/storage/sqlite-storage': { __esModule: true, default: sqliteAdapter },
    '@/libs/storage/types': {},
  });

  await mod.loadInventoryState();
  assert.deepEqual(calls, ['sqlite-load']);
});
