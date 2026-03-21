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
      resolveJsonModule: true,
      esModuleInterop: true,
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

test('catalog sync writes catalog entities when revision changes', async () => {
  const runCalls = [];
  let stateReads = 0;
  const db = {
    getFirstAsync: async () => {
      stateReads += 1;
      return stateReads === 1 ? { value_json: JSON.stringify('old-revision') } : null;
    },
    runAsync: async (sql, params) => {
      runCalls.push({ sql, params });
    },
    execAsync: async () => undefined,
  };

  const mod = loadTsModule(path.resolve(__dirname, '../libs/storage/sqlite/catalog-sync.ts'), {
    '@/assets/data/data.json': {
      cocktails: [{ id: 1, name: 'A' }],
      ingredients: [{ id: 2, name: 'B' }],
    },
    '@/libs/storage/sqlite/schema': {
      APP_STATE_KEYS: { catalogRevision: 'catalogRevision' },
    },
  });

  await mod.syncBundledCatalogIfNeeded(db);

  assert.equal(runCalls.length >= 3, true);
  assert.equal(runCalls.some((call) => String(call.params?.[0]) === 'cocktail'), true);
  assert.equal(runCalls.some((call) => String(call.params?.[0]) === 'ingredient'), true);
});
