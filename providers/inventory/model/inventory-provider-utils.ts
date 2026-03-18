export function sanitizeCustomTags<TTag extends { id?: number | null; name?: string | null; color?: string | null }>(
  tags: readonly TTag[] | null | undefined,
  fallbackColor: string,
  compareByName: (left: string, right: string) => number,
): Array<{ id: number; name: string; color: string }> {
  if (!tags || tags.length === 0) {
    return [];
  }

  const map = new Map<number, { id: number; name: string; color: string }>();

  tags.forEach((tag) => {
    const rawId = Number(tag.id ?? -1);
    if (!Number.isFinite(rawId) || rawId < 0) {
      return;
    }

    const name = tag.name?.trim();
    if (!name) {
      return;
    }

    const color = typeof tag.color === 'string' && tag.color.trim() ? tag.color : fallbackColor;
    map.set(rawId, { id: Math.trunc(rawId), name, color });
  });

  return Array.from(map.values()).sort((a, b) => compareByName(a.name, b.name));
}

export function sanitizeTranslationOverrides<TOverrides>(
  value: unknown,
  isSupportedLocale: (locale: string) => boolean,
): TOverrides {
  if (!value || typeof value !== 'object') {
    return {} as TOverrides;
  }

  const result: Record<string, unknown> = {};
  Object.entries(value as Record<string, unknown>).forEach(([locale, localeValue]) => {
    if (!isSupportedLocale(locale) || !localeValue || typeof localeValue !== 'object') {
      return;
    }

    const localeRecord = localeValue as Record<string, unknown>;
    const cocktails = localeRecord.cocktails;
    const ingredients = localeRecord.ingredients;
    const nextLocale: Record<string, unknown> = {};
    if (cocktails && typeof cocktails === 'object') {
      nextLocale.cocktails = cocktails;
    }
    if (ingredients && typeof ingredients === 'object') {
      nextLocale.ingredients = ingredients;
    }

    result[locale] = nextLocale;
  });

  return result as TOverrides;
}

export function getNextCustomTagId(tags: readonly { id?: number | null }[], minimum: number): number {
  const maxId = tags.reduce((max, tag) => {
    const id = Number(tag.id ?? -1);
    if (!Number.isFinite(id) || id < 0) {
      return max;
    }
    return Math.max(max, Math.trunc(id));
  }, minimum);

  return maxId + 1;
}

export function sanitizePartySelectedCocktailKeys(values?: readonly string[] | null): Set<string> {
  if (!values || values.length === 0) {
    return new Set<string>();
  }

  const normalized = values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);

  return new Set(normalized);
}
