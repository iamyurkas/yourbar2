export const TAG_COLORS = [
  '#ec5a5a',
  '#F06292',
  '#BA68C8',
  '#9575CD',
  '#7986CB',
  '#64B5F6',
  '#4FC3F7',
  '#4DD0E1',
  '#4DB6AC',
  '#81C784',
  '#AED581',
  '#DCE775',
  '#FFD54F',
  '#FFB74D',
  '#FF8A65',
  '#a8a8a8',
] as const;

export const BUILTIN_INGREDIENT_TAGS = [
  { id: 1, name: 'strong alcohol', color: TAG_COLORS[0] },
  { id: 2, name: 'soft alcohol', color: TAG_COLORS[1] },
  { id: 3, name: 'beverage', color: TAG_COLORS[3] },
  { id: 4, name: 'syrup', color: TAG_COLORS[13] },
  { id: 5, name: 'juice', color: TAG_COLORS[10] },
  { id: 6, name: 'fruit', color: TAG_COLORS[9] },
  { id: 7, name: 'herb', color: TAG_COLORS[8] },
  { id: 8, name: 'spice', color: TAG_COLORS[14] },
  { id: 9, name: 'dairy', color: TAG_COLORS[6] },
  { id: 10, name: 'other', color: TAG_COLORS[15] },
] as const;

export type BuiltInIngredientTag = (typeof BUILTIN_INGREDIENT_TAGS)[number];
