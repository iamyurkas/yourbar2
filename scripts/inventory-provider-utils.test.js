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

const {
  sanitizeCustomTags,
  sanitizeTranslationOverrides,
  getNextCustomTagId,
} = loadTsModule(path.resolve(__dirname, '../providers/inventory/model/inventory-provider-utils.ts'));

test('sanitizeCustomTags filters invalid entries, deduplicates by id and sorts by name', () => {
  const result = sanitizeCustomTags(
    [
      { id: 2, name: '  Zed ', color: '' },
      { id: 1, name: 'Alpha', color: '#111' },
      { id: 1, name: 'Ignored duplicate', color: '#222' },
      { id: -5, name: 'Bad id' },
      { id: 4, name: '   ' },
    ],
    '#f00',
    (a, b) => a.localeCompare(b),
  );

  const normalized = JSON.parse(JSON.stringify(result));
  assert.deepEqual(normalized, [
    { id: 1, name: 'Ignored duplicate', color: '#222' },
    { id: 2, name: 'Zed', color: '#f00' },
  ]);
});

test('sanitizeTranslationOverrides keeps only supported locales and object sections', () => {
  const result = sanitizeTranslationOverrides(
    {
      'en-US': {
        cocktails: { '1': { name: 'A' } },
        ingredients: { '2': { name: 'B' } },
      },
      'xx-YY': { cocktails: { '3': { name: 'Bad locale' } } },
      'uk-UA': { cocktails: 'bad', ingredients: { '4': { name: 'C' } } },
    },
    (locale) => locale === 'en-US' || locale === 'uk-UA',
  );

  const normalized = JSON.parse(JSON.stringify(result));
  assert.deepEqual(normalized, {
    'en-US': {
      cocktails: { '1': { name: 'A' } },
      ingredients: { '2': { name: 'B' } },
    },
    'uk-UA': {
      ingredients: { '4': { name: 'C' } },
    },
  });
});

test('getNextCustomTagId returns next id after max valid id', () => {
  const next = getNextCustomTagId(
    [
      { id: 10000 },
      { id: '10002' },
      { id: -1 },
      { id: null },
    ],
    9999,
  );

  assert.equal(next, 10003);
});
