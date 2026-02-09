import { TAG_COLORS } from "./tag-colors";

export const BUILTIN_INGREDIENT_TAGS = [
  { id: 0, name: "Base Alcohol", color: TAG_COLORS[16] },
  { id: 1, name: "Strong Alcohol", color: TAG_COLORS[0] },
  { id: 2, name: "Soft Alcohol", color: TAG_COLORS[1] },
  { id: 3, name: "Beverage", color: TAG_COLORS[3] },
  { id: 4, name: "Syrup", color: TAG_COLORS[13] },
  { id: 5, name: "Juice", color: TAG_COLORS[10] },
  { id: 6, name: "Fruit", color: TAG_COLORS[9] },
  { id: 7, name: "Herb", color: TAG_COLORS[8] },
  { id: 8, name: "Spice", color: TAG_COLORS[14] },
  { id: 9, name: "Dairy", color: TAG_COLORS[6] },
  { id: 10, name: "Other", color: TAG_COLORS[15] },
] as const;

export type BuiltInIngredientTag = (typeof BUILTIN_INGREDIENT_TAGS)[number];
