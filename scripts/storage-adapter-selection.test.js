const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

function loadTsModule(filePath, stubs = {}, env = {}) {
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
      return loadTsModule(resolved, stubs, env);
    }
    return require(specifier);
  };

  const context = vm.createContext({
    module,
    exports: module.exports,
    require: localRequire,
    __dirname: path.dirname(filePath),
    __filename: filePath,
    process: { env: { ...process.env, ...env } },
    console,
  });

  new vm.Script(transpiled, { filename: filePath }).runInContext(context);
  return module.exports;
}

const sqliteAdapter = { id: 'sqlite' };
const fileAdapter = { id: 'file' };
const stubs = {
  '@/libs/storage/sqlite-storage': { sqliteStorageAdapter: sqliteAdapter },
  '@/libs/storage/file-storage': { fileStorageAdapter: fileAdapter },
};

test('storage index selects sqlite adapter when env flag is true', () => {
  const mod = loadTsModule(path.resolve(__dirname, '../libs/storage/index.ts'), stubs, {
    EXPO_PUBLIC_USE_SQLITE_STORAGE: 'true',
  });

  assert.equal(mod.getActiveStorageAdapter(), sqliteAdapter);
});

test('storage index selects file adapter when env flag is false', () => {
  const mod = loadTsModule(path.resolve(__dirname, '../libs/storage/index.ts'), stubs, {
    EXPO_PUBLIC_USE_SQLITE_STORAGE: 'false',
  });

  assert.equal(mod.getActiveStorageAdapter(), fileAdapter);
});
