const fs = require('fs');
const path = require('path');

const REQUIRED_COCKTAIL_FIELDS = ['name', 'description', 'instructions'];
const REQUIRED_INGREDIENT_FIELDS = ['name', 'description'];

function buildLocaleReport({ data, code, dict }) {
  const keys = new Set(Object.keys(dict ?? {}));
  const isEmptyOverlay = keys.size === 0;
  const missing = [];

  if (!isEmptyOverlay) {
    for (const cocktail of data.cocktails ?? []) {
      for (const field of REQUIRED_COCKTAIL_FIELDS) {
        const key = `cocktail.${cocktail.id}.${field}`;
        if (!keys.has(key)) {
          missing.push(key);
        }
      }
    }

    for (const ingredient of data.ingredients ?? []) {
      for (const field of REQUIRED_INGREDIENT_FIELDS) {
        const key = `ingredient.${ingredient.id}.${field}`;
        if (!keys.has(key)) {
          missing.push(key);
        }
      }
    }
  }

  const extra = Array.from(keys).filter((key) => {
    if (/^cocktail\.\d+\.(name|description|instructions)$/.test(key)) {
      return false;
    }
    if (/^ingredient\.\d+\.(name|description)$/.test(key)) {
      return false;
    }
    if (/^cocktail\.\d+\.ingredient\.\d+\.name$/.test(key)) {
      return false;
    }
    return true;
  });

  return {
    code,
    keyCount: keys.size,
    isEmptyOverlay,
    requiredCocktailKeyCount: (data.cocktails ?? []).length * REQUIRED_COCKTAIL_FIELDS.length,
    requiredIngredientKeyCount: (data.ingredients ?? []).length * REQUIRED_INGREDIENT_FIELDS.length,
    missing,
    extra,
  };
}

function loadCatalogLocales({ root = process.cwd(), onlyLocale } = {}) {
  const dataPath = path.join(root, 'assets/data/data.json');
  const localesDir = path.join(root, 'libs/i18n/locales/catalog');

  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const locales = fs
    .readdirSync(localesDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => ({ code: name.replace('.json', ''), file: path.join(localesDir, name) }))
    .filter((entry) => (onlyLocale ? entry.code === onlyLocale : true))
    .map((entry) => ({
      code: entry.code,
      dict: JSON.parse(fs.readFileSync(entry.file, 'utf8')),
    }));

  return { data, locales };
}

module.exports = {
  REQUIRED_COCKTAIL_FIELDS,
  REQUIRED_INGREDIENT_FIELDS,
  buildLocaleReport,
  loadCatalogLocales,
};
