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
  createIngredientIdSet,
  sanitizeStartScreen,
  sanitizeAppTheme,
  sanitizeAppLocale,
  sanitizeAmazonStoreOverride,
  sanitizeCocktailDefaultServings,
} = loadTsModule(path.resolve(__dirname, '../providers/inventory/model/inventory-provider-sanitizers.ts'));

test('createIngredientIdSet normalizes numbers and drops invalid values', () => {
  const ids = createIngredientIdSet([1, '2', 2.9, Number.NaN, Infinity, -4]);

  assert.equal(ids.has(1), true);
  assert.equal(ids.has(2), true);
  assert.equal(ids.has(-4), true);
  assert.equal(ids.has(3), false);
  assert.equal(ids.size, 3);
});

test('sanitizeStartScreen keeps known values and falls back otherwise', () => {
  assert.equal(sanitizeStartScreen('cocktails_all', 'fallback'), 'cocktails_all');
  assert.equal(sanitizeStartScreen('unknown', 'fallback'), 'fallback');
  assert.equal(sanitizeStartScreen(undefined, 'fallback'), 'fallback');
});

test('sanitizeAppTheme keeps known values and falls back otherwise', () => {
  assert.equal(sanitizeAppTheme('dark', 'light'), 'dark');
  assert.equal(sanitizeAppTheme('weird', 'light'), 'light');
});

test('sanitizeAppLocale uses validator callback', () => {
  const isSupportedLocale = (value) => value === 'uk-UA' || value === 'en-US';

  assert.equal(sanitizeAppLocale('uk-UA', isSupportedLocale, 'en-US'), 'uk-UA');
  assert.equal(sanitizeAppLocale('xx-YY', isSupportedLocale, 'en-US'), 'en-US');
});

test('sanitizeAmazonStoreOverride supports DISABLED and allowed stores', () => {
  const stores = { US: {}, GB: {} };

  assert.equal(sanitizeAmazonStoreOverride('disabled', stores), 'DISABLED');
  assert.equal(sanitizeAmazonStoreOverride('us', stores), 'US');
  assert.equal(sanitizeAmazonStoreOverride('pl', stores), null);
});

test('sanitizeCocktailDefaultServings clamps and truncates values', () => {
  assert.equal(sanitizeCocktailDefaultServings(3.9, 1, 6), 3);
  assert.equal(sanitizeCocktailDefaultServings(0, 1, 6), 1);
  assert.equal(sanitizeCocktailDefaultServings(99, 1, 6), 6);
  assert.equal(sanitizeCocktailDefaultServings(Number.NaN, 1, 6), 1);
});
