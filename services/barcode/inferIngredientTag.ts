import { BUILTIN_INGREDIENT_TAGS } from '@/constants/ingredient-tags';
import type { ScannedProductDraft } from '@/services/barcode/types';

type TagAlias =
  | 'baseSpirit'
  | 'liqueur'
  | 'wine'
  | 'beer'
  | 'bitters'
  | 'syrup'
  | 'mixer'
  | 'juice'
  | 'pantry'
  | 'other';

const TAG_NAME_ALIASES: Record<TagAlias, string[]> = {
  baseSpirit: ['base spirit'],
  liqueur: ['liqueur'],
  wine: ['wine/vermouth'],
  beer: ['beer/cider'],
  bitters: ['bitters'],
  syrup: ['syrup'],
  mixer: ['mixer'],
  juice: ['fruit/veg & juice'],
  pantry: ['fridge/pantry'],
  other: ['other'],
};

const TAG_ID_BY_NAME = new Map(
  BUILTIN_INGREDIENT_TAGS.map((tag) => [tag.name.trim().toLowerCase(), tag.id]),
);

function resolveTagId(alias: TagAlias): number {
  const candidates = TAG_NAME_ALIASES[alias];
  for (const candidateName of candidates) {
    const candidateId = TAG_ID_BY_NAME.get(candidateName);
    if (candidateId != null) {
      return candidateId;
    }
  }

  const fallbackOther = TAG_ID_BY_NAME.get('other');
  if (fallbackOther != null) {
    return fallbackOther;
  }

  return BUILTIN_INGREDIENT_TAGS[0]?.id ?? 0;
}

const TAG_ID: Record<TagAlias, number> = {
  baseSpirit: resolveTagId('baseSpirit'),
  liqueur: resolveTagId('liqueur'),
  wine: resolveTagId('wine'),
  beer: resolveTagId('beer'),
  bitters: resolveTagId('bitters'),
  syrup: resolveTagId('syrup'),
  mixer: resolveTagId('mixer'),
  juice: resolveTagId('juice'),
  pantry: resolveTagId('pantry'),
  other: resolveTagId('other'),
};

const TAG_KEYWORDS: { id: number; words: string[] }[] = [
  { id: TAG_ID.beer, words: ['beer', 'cider', 'lager', 'stout', 'ipa', 'ale', 'porter'] },
  { id: TAG_ID.wine, words: ['wine', 'vermouth', 'prosecco', 'champagne', 'sherry'] },
  { id: TAG_ID.liqueur, words: ['liqueur', 'amaro', 'aperitif', 'schnapps', 'triple sec'] },
  { id: TAG_ID.bitters, words: ['bitters'] },
  { id: TAG_ID.syrup, words: ['syrup', 'sirop', 'grenadine', 'orgeat'] },
  { id: TAG_ID.juice, words: ['juice', 'puree', 'purée', 'nectar'] },
  { id: TAG_ID.mixer, words: ['tonic', 'soda', 'cola', 'ginger beer', 'ginger ale', 'sparkling water'] },
  { id: TAG_ID.pantry, words: ['sauce', 'mustard', 'vinegar', 'oil', 'honey'] },
];

export function inferIngredientTagIdFromDraft(draft: Pick<ScannedProductDraft, 'name' | 'description' | 'abv'>): number {
  const searchText = `${draft.name ?? ''} ${draft.description ?? ''}`.trim().toLowerCase();

  for (const config of TAG_KEYWORDS) {
    if (config.words.some((word) => searchText.includes(word))) {
      return config.id;
    }
  }

  const abv = Number(draft.abv);
  if (Number.isFinite(abv) && abv > 0) {
    if (abv >= 30) {
      return TAG_ID.baseSpirit;
    }
    if (abv >= 15) {
      return TAG_ID.liqueur;
    }
    if (abv >= 7) {
      return TAG_ID.wine;
    }
    return TAG_ID.beer;
  }

  return TAG_ID.other;
}
