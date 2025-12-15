export type CocktailUnit = {
  id: number;
  singular: string;
  plural?: string;
  short?: string;
};

export const MEASURE_UNITS = [
  { id: 1, singular: ' ', plural: ' ' },
  { id: 2, singular: 'bar spoon', plural: 'bar spoons' },
  { id: 3, singular: 'cl', plural: 'cl' },
  { id: 4, singular: 'cube', plural: 'cubes' },
  { id: 5, singular: 'cup', plural: 'cups' },
  { id: 6, singular: 'dash', plural: 'dashes' },
  { id: 7, singular: 'drop', plural: 'drops' },
  { id: 8, singular: 'gr', plural: 'gr' },
  { id: 9, singular: 'half', plural: 'halves' },
  { id: 10, singular: 'leaf', plural: 'leaves' },
  { id: 11, singular: 'ml', plural: 'ml' },
  { id: 12, singular: 'oz', plural: 'oz' },
  { id: 13, singular: 'part', plural: 'parts' },
  { id: 14, singular: 'peel', plural: 'peels' },
  { id: 15, singular: 'pinch', plural: 'pinches' },
  { id: 16, singular: 'quarter', plural: 'quarters' },
  { id: 17, singular: 'scoop', plural: 'scoops' },
  { id: 18, singular: 'shaving', plural: 'shavings' },
  { id: 19, singular: 'slice', plural: 'slices' },
  { id: 20, singular: 'splash', plural: 'splashes' },
  { id: 21, singular: 'spring', plural: 'springs' },
  { id: 22, singular: 'stalk', plural: 'stalks' },
  { id: 23, singular: 'tablespoon', plural: 'tablespoons' },
  { id: 24, singular: 'teaspoon', plural: 'teaspoons' },
  { id: 25, singular: 'third', plural: 'thirds' },
  { id: 26, singular: 'twist', plural: 'twists' },
  { id: 27, singular: 'wedge', plural: 'wedges' },
] satisfies CocktailUnit[];

const NORMALIZED_MEASURE_UNITS: CocktailUnit[] = MEASURE_UNITS.map((unit) => ({
  ...unit,
  singular: unit.singular.trim(),
  plural: unit.plural?.trim() || undefined,
}));

export const COCKTAIL_UNIT_DICTIONARY: Record<number, CocktailUnit> = NORMALIZED_MEASURE_UNITS.reduce(
  (dictionary, unit) => {
    dictionary[unit.id] = unit;
    return dictionary;
  },
  {} as Record<number, CocktailUnit>,
);

export const COCKTAIL_UNIT_OPTIONS = NORMALIZED_MEASURE_UNITS.map((unit) => ({
  id: unit.id,
  label: unit.singular,
})) satisfies { id: number; label: string }[];

export function getCocktailUnitLabel(unitId?: number | null): string | undefined {
  if (unitId == null) {
    return undefined;
  }
  const entry = COCKTAIL_UNIT_DICTIONARY[unitId];
  const label = entry?.singular.trim();
  return label || undefined;
}
