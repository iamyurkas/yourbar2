const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { buildLocaleReport, loadCatalogLocales } = require('./catalog-overlay-checker');

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

test('loadCatalogLocales respects onlyLocale filter', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-overlay-'));
  fs.mkdirSync(path.join(tmpRoot, 'assets', 'data'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'libs', 'i18n', 'locales', 'catalog'), { recursive: true });

  fs.writeFileSync(
    path.join(tmpRoot, 'assets', 'data', 'data.json'),
    JSON.stringify(SAMPLE_DATA),
    'utf8',
  );
  fs.writeFileSync(
    path.join(tmpRoot, 'libs', 'i18n', 'locales', 'catalog', 'en-US.json'),
    JSON.stringify({ 'cocktail.10.name': 'A' }),
    'utf8',
  );
  fs.writeFileSync(
    path.join(tmpRoot, 'libs', 'i18n', 'locales', 'catalog', 'uk-UA.json'),
    JSON.stringify({ 'cocktail.10.name': 'Б' }),
    'utf8',
  );

  const loaded = loadCatalogLocales({ root: tmpRoot, onlyLocale: 'uk-UA' });
  assert.equal(loaded.locales.length, 1);
  assert.equal(loaded.locales[0].code, 'uk-UA');
});
