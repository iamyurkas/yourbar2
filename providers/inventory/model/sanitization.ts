import { TAG_COLORS } from '@/constants/tag-colors';
import { type AppTheme, type StartScreen } from '../inventory-types';

export const DEFAULT_START_SCREEN: StartScreen = 'cocktails_all';
export const DEFAULT_APP_THEME: AppTheme = 'light';
export const DEFAULT_TAG_COLOR = TAG_COLORS[0];

export function sanitizeCocktailRatings(
  ratings?: Record<string, number> | null | undefined,
): Record<string, number> {
  if (!ratings) {
    return {};
  }

  const sanitized: Record<string, number> = {};
  Object.entries(ratings).forEach(([key, value]) => {
    const normalized = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
    if (normalized > 0) {
      sanitized[key] = normalized;
    }
  });
  return sanitized;
}

export function sanitizeStartScreen(value?: string | null): StartScreen {
  switch (value) {
    case 'cocktails_all':
    case 'cocktails_my':
    case 'cocktails_favorites':
    case 'shaker':
    case 'ingredients_all':
    case 'ingredients_my':
    case 'ingredients_shopping':
      return value;
    default:
      return DEFAULT_START_SCREEN;
  }
}

export function sanitizeAppTheme(value?: string | null): AppTheme {
  switch (value) {
    case 'light':
    case 'dark':
    case 'system':
      return value;
    default:
      return DEFAULT_APP_THEME;
  }
}

export function sanitizeCustomTags<TTag extends { id?: number | null; name?: string | null; color?: string | null }>(
  tags: readonly TTag[] | null | undefined,
  fallbackColor: string,
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

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function toSortedArray(values: Iterable<number>): number[] {
  const sanitized = Array.from(values)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.trunc(value));

  return Array.from(new Set(sanitized)).sort((a, b) => a - b);
}

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
