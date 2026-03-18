const test = require('node:test');
const assert = require('node:assert/strict');

const { buildLocaleReport } = require('./catalog-overlay-checker');

const SAMPLE_DATA = {
  cocktails: [{ id: 10 }],
  ingredients: [{ id: 20 }],
};

test('buildLocaleReport treats empty overlay as valid fallback without missing keys', () => {
  const report = buildLocaleReport({
    data: SAMPLE_DATA,
    code: 'uk-UA',
    dict: {},
  });

  assert.equal(report.code, 'uk-UA');
  assert.equal(report.isEmptyOverlay, true);
  assert.equal(report.missing.length, 0);
  assert.equal(report.extra.length, 0);
  assert.equal(report.requiredCocktailKeyCount, 3);
  assert.equal(report.requiredIngredientKeyCount, 2);
});

test('buildLocaleReport reports missing required keys for non-empty overlay', () => {
  const report = buildLocaleReport({
    data: SAMPLE_DATA,
    code: 'en-US',
    dict: {
      'cocktail.10.name': 'Name only',
    },
  });

  assert.equal(report.isEmptyOverlay, false);
  assert.deepEqual(report.missing, [
    'cocktail.10.description',
    'cocktail.10.instructions',
    'ingredient.20.name',
    'ingredient.20.description',
  ]);
});

test('buildLocaleReport keeps optional recipe ingredient name keys and flags unknown keys', () => {
  const report = buildLocaleReport({
    data: SAMPLE_DATA,
    code: 'de-DE',
    dict: {
      'cocktail.10.name': 'x',
      'cocktail.10.description': 'x',
      'cocktail.10.instructions': 'x',
      'cocktail.10.ingredient.1.name': 'optional ingredient override',
      'ingredient.20.name': 'y',
      'ingredient.20.description': 'y',
      'ingredient.20.foo': 'unknown',
    },
  });

  assert.equal(report.missing.length, 0);
  assert.deepEqual(report.extra, ['ingredient.20.foo']);
});
