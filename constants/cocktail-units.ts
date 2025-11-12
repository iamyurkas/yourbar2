export type CocktailUnit = {
  id: number;
  singular: string;
  plural?: string;
  short?: string;
};

export const COCKTAIL_UNIT_DICTIONARY: Record<number, CocktailUnit> = {
  1: { id: 1, singular: 'piece', plural: 'pieces', short: 'pc' },
  2: { id: 2, singular: 'bar spoon', plural: 'bar spoons', short: 'bar spoon' },
  4: { id: 4, singular: 'teaspoon', plural: 'teaspoons', short: 'tsp' },
  6: { id: 6, singular: 'dash', plural: 'dashes' },
  7: { id: 7, singular: 'drop', plural: 'drops' },
  8: { id: 8, singular: 'g', plural: 'g' },
  9: { id: 9, singular: 'pinch', plural: 'pinches' },
  10: { id: 10, singular: 'leaf', plural: 'leaves' },
  11: { id: 11, singular: 'ml', plural: 'ml', short: 'ml' },
  12: { id: 12, singular: 'oz', plural: 'oz', short: 'oz' },
  14: { id: 14, singular: 'cup', plural: 'cups' },
  15: { id: 15, singular: 'pinch', plural: 'pinches' },
  17: { id: 17, singular: 'splash', plural: 'splashes' },
  18: { id: 18, singular: 'scoop', plural: 'scoops' },
  19: { id: 19, singular: 'piece', plural: 'pieces' },
  20: { id: 20, singular: 'bottle', plural: 'bottles' },
  21: { id: 21, singular: 'sprig', plural: 'sprigs' },
  22: { id: 22, singular: 'tablespoon', plural: 'tablespoons', short: 'tbsp' },
  24: { id: 24, singular: 'ml', plural: 'ml', short: 'ml' },
  26: { id: 26, singular: 'piece', plural: 'pieces' },
  27: { id: 27, singular: 'piece', plural: 'pieces' },
  31: { id: 31, singular: 'spray', plural: 'sprays' },
};

export const COCKTAIL_UNIT_OPTIONS = [
  { id: 11, label: 'ml' },
  { id: 12, label: 'oz' },
  { id: 2, label: 'bar spoon' },
  { id: 4, label: 'teaspoon' },
  { id: 22, label: 'tablespoon' },
  { id: 6, label: 'dash' },
  { id: 7, label: 'drop' },
  { id: 8, label: 'g' },
  { id: 9, label: 'pinch' },
  { id: 10, label: 'leaf' },
  { id: 21, label: 'sprig' },
  { id: 14, label: 'cup' },
  { id: 17, label: 'splash' },
  { id: 18, label: 'scoop' },
  { id: 20, label: 'bottle' },
  { id: 1, label: 'piece' },
  { id: 31, label: 'spray' },
] satisfies { id: number; label: string }[];

export function getCocktailUnitLabel(unitId?: number | null): string | undefined {
  if (unitId == null) {
    return undefined;
  }
  const entry = COCKTAIL_UNIT_DICTIONARY[unitId];
  return entry?.singular;
}
