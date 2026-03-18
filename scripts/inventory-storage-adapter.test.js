const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

function loadTsModule(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;

  const module = { exports: {} };
  const mockedFileSystem = {
    documentDirectory: '/tmp/',
    cacheDirectory: '/tmp/',
    getInfoAsync: async () => ({ exists: false }),
    readAsStringAsync: async () => '',
    writeAsStringAsync: async () => undefined,
    deleteAsync: async () => undefined,
  };

  const customRequire = (specifier) => {
    if (specifier === 'expo-file-system/legacy') {
      return mockedFileSystem;
    }

    return require(specifier);
  };

  const context = vm.createContext({
    module,
    exports: module.exports,
    require: customRequire,
    process,
    __dirname: path.dirname(filePath),
    __filename: filePath,
    console,
  });

  new vm.Script(transpiled, { filename: filePath }).runInContext(context);
  return module.exports;
}

const storage = loadTsModule(path.resolve(__dirname, '../libs/inventory-storage.ts'));
const { __inventoryStorageTesting } = storage;

test('normalizeLegacySnapshot converts v1 payload to v3 delta format', () => {
  const normalized = __inventoryStorageTesting.normalizeLegacySnapshot({
    version: 1,
    cocktails: [{ id: 1, name: 'A' }],
    ingredients: [{ id: 2, name: 'B' }],
    partySelectedCocktailKeys: ['c1'],
  });

  const plain = JSON.parse(JSON.stringify(normalized));
  assert.equal(plain.version, 3);
  assert.deepEqual(plain.delta.cocktails.updated, [{ id: 1, name: 'A' }]);
  assert.deepEqual(plain.delta.ingredients.updated, [{ id: 2, name: 'B' }]);
  assert.deepEqual(plain.partySelectedCocktailKeys, ['c1']);
});

test('sanitize helpers filter invalid values and dedupe', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(__inventoryStorageTesting.sanitizeStringList(['  a ', '', 'a', 5]))), ['a']);
  assert.deepEqual(JSON.parse(JSON.stringify(__inventoryStorageTesting.sanitizeNumberList([1, '2', 2, null, 'x']))), [1, 2]);
});

test('withTransaction rolls back when callback throws', async () => {
  const calls = [];
  const db = {
    execAsync: async (statement) => {
      calls.push(statement);
    },
  };

  await assert.rejects(
    __inventoryStorageTesting.withTransaction(db, async () => {
      throw new Error('boom');
    }),
    /boom/,
  );

  assert.deepEqual(calls, ['BEGIN IMMEDIATE TRANSACTION;', 'ROLLBACK;']);
});

test('withTransaction commits when callback succeeds', async () => {
  const calls = [];
  const db = {
    execAsync: async (statement) => {
      calls.push(statement);
    },
  };

  await __inventoryStorageTesting.withTransaction(db, async () => {
    calls.push('WORK');
  });

  assert.deepEqual(calls, ['BEGIN IMMEDIATE TRANSACTION;', 'WORK', 'COMMIT;']);
});
