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
  });

  new vm.Script(transpiled, { filename: filePath }).runInContext(context);
  return module.exports;
}

test('catalog revision changes when bundled catalog changes', () => {
  const baseData = {
    cocktails: [{ id: 1, name: 'One' }],
    ingredients: [{ id: 1, name: 'Gin' }],
  };

  const modA = loadTsModule(path.resolve(__dirname, '../libs/storage/sqlite/catalog-sync.ts'), {
    '@/libs/inventory-data': { loadInventoryData: () => baseData },
  });
  const revA = modA.computeBundledCatalogRevision();

  const modB = loadTsModule(path.resolve(__dirname, '../libs/storage/sqlite/catalog-sync.ts'), {
    '@/libs/inventory-data': {
      loadInventoryData: () => ({
        ...baseData,
        cocktails: [...baseData.cocktails, { id: 2, name: 'Two' }],
      }),
    },
  });
  const revB = modB.computeBundledCatalogRevision();

  assert.notEqual(revA, revB);
});
