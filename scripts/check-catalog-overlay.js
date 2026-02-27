#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const dataPath = path.join(root, 'assets/data/data.json');
const localesDir = path.join(root, 'libs/i18n/locales/catalog');

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const localeArg = args.find((arg) => arg.startsWith('--locale='));
const onlyLocale = localeArg ? localeArg.split('=')[1] : undefined;

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const locales = fs
  .readdirSync(localesDir)
  .filter((name) => name.endsWith('.json'))
  .map((name) => ({ code: name.replace('.json', ''), file: path.join(localesDir, name) }))
  .filter((entry) => (onlyLocale ? entry.code === onlyLocale : true));

if (locales.length === 0) {
  console.error('No catalog overlay locale files found.');
  process.exit(1);
}

const requiredCocktailFields = ['name', 'description', 'instructions'];
const requiredIngredientFields = ['name', 'description'];

let hasMissing = false;

for (const locale of locales) {
  const dict = JSON.parse(fs.readFileSync(locale.file, 'utf8'));
  const keys = new Set(Object.keys(dict));

  const missing = [];
  for (const cocktail of data.cocktails ?? []) {
    for (const field of requiredCocktailFields) {
      const key = `cocktail.${cocktail.id}.${field}`;
      if (!keys.has(key)) {
        missing.push(key);
      }
    }
  }

  for (const ingredient of data.ingredients ?? []) {
    for (const field of requiredIngredientFields) {
      const key = `ingredient.${ingredient.id}.${field}`;
      if (!keys.has(key)) {
        missing.push(key);
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

  console.log(`\n[${locale.code}]`);
  console.log(`required cocktail keys: ${(data.cocktails ?? []).length * requiredCocktailFields.length}`);
  console.log(`required ingredient keys: ${(data.ingredients ?? []).length * requiredIngredientFields.length}`);
  console.log(`present keys: ${keys.size}`);
  console.log(`missing required keys: ${missing.length}`);
  console.log(`extra/unknown keys: ${extra.length}`);

  if (missing.length > 0) {
    hasMissing = true;
    console.log('sample missing:');
    missing.slice(0, 20).forEach((key) => console.log(`  - ${key}`));
  }

  if (extra.length > 0) {
    console.log('sample extra:');
    extra.slice(0, 20).forEach((key) => console.log(`  - ${key}`));
  }
}

if (strict && hasMissing) {
  process.exit(2);
}
