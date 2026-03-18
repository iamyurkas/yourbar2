#!/usr/bin/env node
/* eslint-disable no-console */

const {
  buildLocaleReport,
  loadCatalogLocales,
} = require('./catalog-overlay-checker');

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const localeArg = args.find((arg) => arg.startsWith('--locale='));
const onlyLocale = localeArg ? localeArg.split('=')[1] : undefined;

const { data, locales } = loadCatalogLocales({ onlyLocale });

if (locales.length === 0) {
  console.error('No catalog overlay locale files found.');
  process.exit(1);
}

let hasMissing = false;

for (const locale of locales) {
  const report = buildLocaleReport({ data, code: locale.code, dict: locale.dict });

  console.log(`\n[${report.code}]`);
  console.log(`required cocktail keys: ${report.requiredCocktailKeyCount}`);
  console.log(`required ingredient keys: ${report.requiredIngredientKeyCount}`);
  console.log(`present keys: ${report.keyCount}`);
  console.log(`missing required keys: ${report.missing.length}`);
  console.log(`extra/unknown keys: ${report.extra.length}`);
  if (report.isEmptyOverlay) {
    console.log('note: empty overlay allowed (fallback to base catalog data).');
  }

  if (report.missing.length > 0) {
    hasMissing = true;
    console.log('sample missing:');
    report.missing.slice(0, 20).forEach((key) => console.log(`  - ${key}`));
  }

  if (report.extra.length > 0) {
    console.log('sample extra:');
    report.extra.slice(0, 20).forEach((key) => console.log(`  - ${key}`));
  }
}

if (strict && hasMissing) {
  process.exit(2);
}
