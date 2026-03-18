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
  buildCocktailFeedbackExport,
  parseCocktailFeedbackImport,
  buildIngredientStatusExport,
  parseIngredientStatusImport,
} = loadTsModule(path.resolve(__dirname, '../providers/inventory/model/inventory-provider-mappers.ts'));

const sanitize = {
  ratings: (value) => Object.fromEntries(Object.entries(value).filter(([, v]) => Number.isFinite(v) && v >= 0 && v <= 5)),
  comments: (value) => Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v === 'string' && v.trim().length > 0)),
};

test('buildCocktailFeedbackExport combines ratings and comments after sanitization', () => {
  const feedback = buildCocktailFeedbackExport(
    { '1': 4, '2': -1 },
    { '1': 'great', '3': '  ' },
    sanitize,
  );

  assert.equal(feedback['1'].rating, 4);
  assert.equal(feedback['1'].comment, 'great');
  assert.equal(Object.prototype.hasOwnProperty.call(feedback, '2'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(feedback, '3'), false);
});

test('parseCocktailFeedbackImport filters invalid entries and sanitizes results', () => {
  const parsed = parseCocktailFeedbackImport({
    cocktailFeedback: {
      '10': { rating: 5, comment: 'top' },
      '11': { rating: 'oops', comment: 'ok' },
      '12': { rating: 7, comment: '' },
      '13': null,
    },
  }, sanitize);

  assert.equal(parsed.ratings['10'], 5);
  assert.equal(parsed.comments['10'], 'top');
  assert.equal(parsed.comments['11'], 'ok');
  assert.equal(Object.prototype.hasOwnProperty.call(parsed.ratings, '11'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(parsed.ratings, '12'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(parsed.comments, '12'), false);
});

test('buildIngredientStatusExport merges availability and shopping flags for same id', () => {
  const status = buildIngredientStatusExport(
    new Set([3, 1]),
    new Set([1, 2]),
    (set) => [...set].sort((a, b) => a - b),
  );

  assert.equal(status['1'].available, true);
  assert.equal(status['1'].shopping, true);
  assert.equal(status['2'].shopping, true);
  assert.equal(status['3'].available, true);
});

test('parseIngredientStatusImport ignores invalid ids and values', () => {
  const parsed = parseIngredientStatusImport({
    ingredientStatus: {
      '1': { available: true },
      '2': { shopping: true },
      '-3': { available: true },
      foo: { shopping: true },
      '4': 'bad',
      '5.8': { available: true },
    },
  });

  assert.equal(parsed.availableIngredientIds.has(1), true);
  assert.equal(parsed.shoppingIngredientIds.has(2), true);
  assert.equal(parsed.availableIngredientIds.has(-3), false);
  assert.equal(parsed.shoppingIngredientIds.has(0), false);
  assert.equal(parsed.availableIngredientIds.has(5), true);
});
