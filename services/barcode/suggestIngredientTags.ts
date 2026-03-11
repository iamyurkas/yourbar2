import { BUILTIN_INGREDIENT_TAGS } from '@/constants/ingredient-tags';
import type { IngredientTag } from '@/providers/inventory-types';
import { normalizeProductName } from '@/services/barcode/normalizeProductName';

const TAG_ID_BY_NAME = new Map(
  BUILTIN_INGREDIENT_TAGS.map((tag) => [tag.name.trim().toLowerCase(), tag.id]),
);

const OTHER_TAG_ID = TAG_ID_BY_NAME.get('other') ?? 9;

const TAG_KEYWORDS: Array<{ tagName: string; keywords: string[] }> = [
  { tagName: 'Base spirit', keywords: ['vodka', 'gin', 'rum', 'tequila', 'mezcal', 'whisky', 'whiskey', 'brandy', 'cognac', 'pisco', 'grappa', 'soju', 'baijiu', 'sake'] },
  { tagName: 'Liqueur', keywords: ['liqueur', 'liquor', 'amaro', 'aperitif', 'cordial', 'triple sec', 'curaçao', 'curacao'] },
  { tagName: 'Wine/Vermouth', keywords: ['wine', 'vermouth', 'sherry', 'port', 'prosecco', 'champagne'] },
  { tagName: 'Beer/Cider', keywords: ['beer', 'lager', 'ale', 'stout', 'porter', 'cider'] },
  { tagName: 'Bitters', keywords: ['bitters'] },
  { tagName: 'Syrup', keywords: ['syrup', 'sirop', 'grenadine', 'orgeat', 'falernum'] },
  { tagName: 'Mixer', keywords: ['soda', 'tonic', 'cola', 'ginger ale', 'lemonade', 'kombucha', 'energy drink'] },
  { tagName: 'Fruit/Veg & Juice', keywords: ['juice', 'fruit', 'vegetable', 'lemon', 'lime', 'orange', 'grapefruit', 'pineapple', 'tomato', 'coconut water'] },
  { tagName: 'Fridge/Pantry', keywords: ['milk', 'cream', 'egg', 'honey', 'salt', 'sugar', 'spice', 'coffee', 'tea', 'water'] },
];

function resolveTagId(tagName: string): number | undefined {
  return TAG_ID_BY_NAME.get(tagName.trim().toLowerCase());
}

export function suggestIngredientTagIds(input: {
  categories?: string[];
  productName?: string;
}): number[] {
  const categoryTokens = (input.categories ?? [])
    .flatMap((item) => item.split(/[>,;/|]/g))
    .map((item) => normalizeProductName(item))
    .filter(Boolean);

  const haystack = [
    ...categoryTokens,
    normalizeProductName(input.productName),
  ].filter(Boolean).join(' ');

  if (!haystack) {
    return [OTHER_TAG_ID];
  }

  const matched = new Set<number>();

  TAG_KEYWORDS.forEach((entry) => {
    const tagId = resolveTagId(entry.tagName);
    if (tagId == null) {
      return;
    }

    if (entry.keywords.some((keyword) => haystack.includes(normalizeProductName(keyword)))) {
      matched.add(tagId);
    }
  });

  if (matched.size === 0) {
    matched.add(OTHER_TAG_ID);
  }

  return Array.from(matched);
}

export function pickIngredientTagsByIds(tags: readonly IngredientTag[], tagIds: readonly number[]): IngredientTag[] {
  const selected = new Map<number, IngredientTag>();

  tagIds.forEach((tagId) => {
    const found = tags.find((tag) => Number(tag.id ?? -1) === tagId);
    if (found && !selected.has(tagId)) {
      selected.set(tagId, found);
    }
  });

  return Array.from(selected.values());
}
