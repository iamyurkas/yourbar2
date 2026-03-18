export function createIngredientIdSet(values?: readonly number[] | null): Set<number> {
  if (!values || values.length === 0) {
    return new Set<number>();
  }

  const sanitized = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.trunc(value));

  return new Set(sanitized);
}

export function sanitizeStartScreen(value: string | null | undefined, defaultStartScreen: string): string {
  switch (value) {
    case 'cocktails_all':
    case 'cocktails_my':
    case 'shaker':
    case 'ingredients_all':
    case 'ingredients_my':
    case 'ingredients_shopping':
      return value;
    default:
      return defaultStartScreen;
  }
}

export function sanitizeAppTheme(value: string | null | undefined, defaultAppTheme: string): string {
  switch (value) {
    case 'light':
    case 'dark':
    case 'system':
      return value;
    default:
      return defaultAppTheme;
  }
}

export function sanitizeAppLocale(
  value: string | null | undefined,
  isSupportedLocale: (candidate?: string | null) => boolean,
  defaultAppLocale: string,
): string {
  return isSupportedLocale(value) && typeof value === 'string' ? value : defaultAppLocale;
}

export function sanitizeAmazonStoreOverride(
  value: string | null | undefined,
  amazonStores: Record<string, unknown>,
): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.toUpperCase();
  if (normalized === 'DISABLED') {
    return 'DISABLED';
  }

  return normalized in amazonStores ? normalized : null;
}

export function sanitizeCocktailDefaultServings(
  value: number | null | undefined,
  min = 1,
  max = 6,
): number {
  const normalized = Number(value ?? min);
  if (!Number.isFinite(normalized)) {
    return min;
  }

  const integerValue = Math.trunc(normalized);
  return Math.max(min, Math.min(max, integerValue));
}
