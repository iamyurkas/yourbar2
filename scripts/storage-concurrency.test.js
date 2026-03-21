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
    process,
    console,
    setTimeout,
    clearTimeout,
  });

  new vm.Script(transpiled, { filename: filePath }).runInContext(context);
  return module.exports;
}

const stubs = {
  'expo-sqlite': { openDatabaseAsync: async () => ({}) },
  '@/libs/storage/file-storage': { fileStorageAdapter: {} },
  '@/libs/storage/sqlite/catalog-sync': { syncBundledCatalogIfNeededInTransaction: async () => {} },
  '@/libs/storage/sqlite/migrations': { migrateAndRepairSchema: async () => {}, runShapeCorrection: async () => {} },
  '@/libs/storage/sqlite/schema': { SQLITE_DB_NAME: 'test.db' },
};

const { SQLiteOperationQueue } = loadTsModule(path.resolve(__dirname, '../libs/storage/sqlite-storage.ts'), stubs);

test('SQLiteOperationQueue serializes rapid operations', async () => {
  const queue = new SQLiteOperationQueue();
  const events = [];

  const op = (label, wait) =>
    queue.run(async () => {
      events.push(`${label}:start`);
      await new Promise((resolve) => setTimeout(resolve, wait));
      events.push(`${label}:end`);
      return label;
    });

  const results = await Promise.all([op('a', 10), op('b', 1), op('c', 1)]);
  assert.deepEqual(results, ['a', 'b', 'c']);
  assert.deepEqual(events, ['a:start', 'a:end', 'b:start', 'b:end', 'c:start', 'c:end']);
});
