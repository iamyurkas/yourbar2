import i18n from "@/libs/i18n";
import { TAG_COLORS } from "./tag-colors";

export type BuiltInIngredientTag = {
  id: number;
  name: string;
  color: string;
};

export function getBuiltinIngredientTags(): BuiltInIngredientTag[] {
  return [
    { id: 0, name: i18n.t("tags.base_alcohol"), color: TAG_COLORS[16] },
    { id: 1, name: i18n.t("tags.strong_alcohol"), color: TAG_COLORS[0] },
    { id: 2, name: i18n.t("tags.soft_alcohol"), color: TAG_COLORS[1] },
    { id: 3, name: i18n.t("tags.beverage"), color: TAG_COLORS[3] },
    { id: 4, name: i18n.t("tags.syrup"), color: TAG_COLORS[13] },
    { id: 5, name: i18n.t("tags.juice"), color: TAG_COLORS[10] },
    { id: 6, name: i18n.t("tags.fruit"), color: TAG_COLORS[9] },
    { id: 7, name: i18n.t("tags.herb"), color: TAG_COLORS[8] },
    { id: 8, name: i18n.t("tags.spice"), color: TAG_COLORS[14] },
    { id: 9, name: i18n.t("tags.dairy"), color: TAG_COLORS[6] },
    { id: 10, name: i18n.t("tags.other"), color: TAG_COLORS[15] },
  ];
}
