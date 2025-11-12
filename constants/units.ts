export type UnitDetails = { singular: string; plural?: string };

export const UNIT_LABELS: Record<number, UnitDetails> = {
  1: { singular: 'piece', plural: 'pieces' },
  2: { singular: 'bar spoon', plural: 'bar spoons' },
  4: { singular: 'teaspoon', plural: 'teaspoons' },
  6: { singular: 'dash', plural: 'dashes' },
  7: { singular: 'drop', plural: 'drops' },
  8: { singular: 'g' },
  9: { singular: 'pinch', plural: 'pinches' },
  10: { singular: 'leaf', plural: 'leaves' },
  11: { singular: 'ml' },
  12: { singular: 'oz' },
  14: { singular: 'cup', plural: 'cups' },
  15: { singular: 'pinch', plural: 'pinches' },
  17: { singular: 'splash', plural: 'splashes' },
  18: { singular: 'scoop', plural: 'scoops' },
  19: { singular: 'piece', plural: 'pieces' },
  20: { singular: 'bottle', plural: 'bottles' },
  21: { singular: 'sprig', plural: 'sprigs' },
  22: { singular: 'tablespoon', plural: 'tablespoons' },
  24: { singular: 'ml' },
  26: { singular: 'piece', plural: 'pieces' },
  27: { singular: 'piece', plural: 'pieces' },
  31: { singular: 'spray', plural: 'sprays' },
};

export type UnitOption = { id: number; label: string; details: UnitDetails };

export const UNIT_OPTIONS: UnitOption[] = Object.entries(UNIT_LABELS)
  .map(([key, details]) => {
    const id = Number(key);
    const label = details.plural ? `${details.singular} (${details.plural})` : details.singular;
    return { id, label, details } satisfies UnitOption;
  })
  .sort((a, b) => a.label.localeCompare(b.label));
