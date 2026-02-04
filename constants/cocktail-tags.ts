import i18n from '@/libs/i18n';
import { TAG_COLORS } from './tag-colors';

export type BuiltInCocktailTag = {
  id: number;
  name: string;
  color: string;
};

// Built-in cocktail tags with stable numeric ids and accessible colors.
export function getBuiltinCocktailTags(): BuiltInCocktailTag[] {
  return [
    { id: 1, name: i18n.t('tags.iba_official'), color: TAG_COLORS[9] },
    { id: 2, name: i18n.t('tags.equal_parts'), color: TAG_COLORS[5] },
    { id: 3, name: i18n.t('tags.bitter'), color: TAG_COLORS[3] },
    { id: 4, name: i18n.t('tags.tiki'), color: TAG_COLORS[7] },
    { id: 5, name: i18n.t('tags.strong'), color: TAG_COLORS[0] },
    { id: 6, name: i18n.t('tags.mild'), color: TAG_COLORS[1] },
    { id: 7, name: i18n.t('tags.soft'), color: TAG_COLORS[12] },
    { id: 8, name: i18n.t('tags.long'), color: TAG_COLORS[13] },
    { id: 9, name: i18n.t('tags.shot'), color: TAG_COLORS[14] },
    { id: 10, name: i18n.t('tags.non_alcoholic'), color: TAG_COLORS[11] },
    { id: 11, name: i18n.t('tags.custom'), color: TAG_COLORS[15] },
  ];
}
