import { TAG_COLORS } from './tag-colors';

// Built-in cocktail tags with stable numeric ids and accessible colors.
export const BUILTIN_COCKTAIL_TAGS = [
  { id: 1, name: 'IBA Official', color: TAG_COLORS[9] },
  { id: 2, name: 'Equal Parts', color: TAG_COLORS[5] },
  { id: 3, name: 'Bitter', color: TAG_COLORS[3] },
  { id: 4, name: 'Tiki', color: TAG_COLORS[7] },
  { id: 5, name: 'Strong', color: TAG_COLORS[0] },
  { id: 6, name: 'Mild', color: TAG_COLORS[1] },
  { id: 7, name: 'Soft', color: TAG_COLORS[12] },
  { id: 8, name: 'Long', color: TAG_COLORS[13] },
  { id: 9, name: 'Shot', color: TAG_COLORS[14] },
  { id: 10, name: 'Non-alcoholic', color: TAG_COLORS[11] },
  { id: 11, name: 'Custom', color: TAG_COLORS[15] },
] as const;

export type BuiltInCocktailTag = (typeof BUILTIN_COCKTAIL_TAGS)[number];
