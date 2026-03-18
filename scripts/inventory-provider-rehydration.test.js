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
  const context = vm.createContext({
    module,
    exports: module.exports,
    require,
    __dirname: path.dirname(filePath),
    __filename: filePath,
  });

  new vm.Script(transpiled, { filename: filePath }).runInContext(context);
  return module.exports;
}

const { rehydrateBuiltInTags } = loadTsModule(
  path.resolve(__dirname, '../providers/inventory/model/inventory-provider-rehydration.ts'),
);

test('rehydrateBuiltInTags updates matching cocktail and ingredient tags from built-ins', () => {
  const state = {
    cocktails: [{ tags: [{ id: 1, name: 'Old cocktail', color: '#111' }, { id: 999, name: 'Custom', color: '#999' }] }],
    ingredients: [{ tags: [{ id: 10, name: 'Old ingredient', color: '#222' }] }],
  };

  const next = rehydrateBuiltInTags(
    state,
    [{ id: 1, name: 'Fresh cocktail', color: '#abc' }],
    [{ id: 10, name: 'Fresh ingredient', color: '#def' }],
  );

  const normalized = JSON.parse(JSON.stringify(next));
  assert.deepEqual(normalized, {
    cocktails: [{ tags: [{ id: 1, name: 'Fresh cocktail', color: '#abc' }, { id: 999, name: 'Custom', color: '#999' }] }],
    ingredients: [{ tags: [{ id: 10, name: 'Fresh ingredient', color: '#def' }] }],
  });
});

test('rehydrateBuiltInTags leaves unknown tags unchanged', () => {
  const state = {
    cocktails: [{ tags: [{ id: 77, name: 'Unknown', color: '#777' }] }],
    ingredients: [{ tags: [{ id: 88, name: 'Unknown ingredient', color: '#888' }] }],
  };

  const next = rehydrateBuiltInTags(state, [], []);
  const normalized = JSON.parse(JSON.stringify(next));

  assert.deepEqual(normalized, state);
});
