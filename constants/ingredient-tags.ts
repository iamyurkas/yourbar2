import { TAG_COLORS } from "./tag-colors";

export const BUILTIN_INGREDIENT_TAGS = [
  { id: 0, name: "Base spirit", color: TAG_COLORS[16] },
  { id: 1, name: "Liqueur", color: TAG_COLORS[0] },
  { id: 2, name: "Wine/Vermouth", color: TAG_COLORS[1] },
  { id: 3, name: "Beer/Cider", color: TAG_COLORS[3] },
  { id: 4, name: "Bitters", color: TAG_COLORS[14] },
  { id: 5, name: "Syrup", color: TAG_COLORS[13] },
  { id: 6, name: "Fruit/Veg & juice", color: TAG_COLORS[10] },
  { id: 7, name: "Mixer", color: TAG_COLORS[9] },
  { id: 8, name: "Fridge/Pantry", color: TAG_COLORS[6] },
  { id: 9, name: "Other", color: TAG_COLORS[15] },
] as const;

export type BuiltInIngredientTag = (typeof BUILTIN_INGREDIENT_TAGS)[number];
