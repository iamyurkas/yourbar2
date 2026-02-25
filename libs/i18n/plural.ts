export type PluralCategory = 'one' | 'few' | 'many' | 'other';

function getUkrainianPluralCategory(count: number): PluralCategory {
  const absolute = Math.abs(count);
  const lastTwoDigits = absolute % 100;
  const lastDigit = absolute % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return 'many';
  }

  if (lastDigit === 1) {
    return 'one';
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'few';
  }

  return 'many';
}

export function getPluralCategory(locale: string, count: number): PluralCategory {
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.PluralRules === 'function') {
      const category = new Intl.PluralRules(locale).select(count);
      if (category === 'one' || category === 'few' || category === 'many') {
        return category;
      }

      return 'other';
    }
  } catch {
    // Fallback below.
  }

  if (locale.toLowerCase().startsWith('uk')) {
    return getUkrainianPluralCategory(count);
  }

  return count === 1 ? 'one' : 'other';
}
