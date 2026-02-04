export type CocktailUnit = {
  id: number;
  singular: string;
  plural?: string;
  short?: string;
};

import i18n from "@/libs/i18n";

export function getMeasureUnits(): CocktailUnit[] {
  return [
    { id: 1, singular: ' ', plural: ' ' },
    { id: 2, singular: i18n.t('units.bar_spoon'), plural: i18n.t('units.bar_spoon_plural') },
    { id: 3, singular: i18n.t('units.cl'), plural: i18n.t('units.cl_plural') },
    { id: 4, singular: i18n.t('units.cube'), plural: i18n.t('units.cube_plural') },
    { id: 5, singular: i18n.t('units.cup'), plural: i18n.t('units.cup_plural') },
    { id: 6, singular: i18n.t('units.dash'), plural: i18n.t('units.dash_plural') },
    { id: 7, singular: i18n.t('units.drop'), plural: i18n.t('units.drop_plural') },
    { id: 8, singular: i18n.t('units.gr'), plural: i18n.t('units.gr_plural') },
    { id: 9, singular: i18n.t('units.half'), plural: i18n.t('units.half_plural') },
    { id: 10, singular: i18n.t('units.leaf'), plural: i18n.t('units.leaf_plural') },
    { id: 11, singular: i18n.t('units.ml'), plural: i18n.t('units.ml_plural') },
    { id: 12, singular: i18n.t('units.oz'), plural: i18n.t('units.oz_plural') },
    { id: 13, singular: i18n.t('units.part'), plural: i18n.t('units.part_plural') },
    { id: 14, singular: i18n.t('units.peel'), plural: i18n.t('units.peel_plural') },
    { id: 15, singular: i18n.t('units.pinch'), plural: i18n.t('units.pinch_plural') },
    { id: 16, singular: i18n.t('units.quarter'), plural: i18n.t('units.quarter_plural') },
    { id: 17, singular: i18n.t('units.scoop'), plural: i18n.t('units.scoop_plural') },
    { id: 18, singular: i18n.t('units.shaving'), plural: i18n.t('units.shaving_plural') },
    { id: 19, singular: i18n.t('units.slice'), plural: i18n.t('units.slice_plural') },
    { id: 20, singular: i18n.t('units.splash'), plural: i18n.t('units.splash_plural') },
    { id: 21, singular: i18n.t('units.spring'), plural: i18n.t('units.spring_plural') },
    { id: 22, singular: i18n.t('units.stalk'), plural: i18n.t('units.stalk_plural') },
    { id: 23, singular: i18n.t('units.tablespoon'), plural: i18n.t('units.tablespoon_plural') },
    { id: 24, singular: i18n.t('units.teaspoon'), plural: i18n.t('units.teaspoon_plural') },
    { id: 25, singular: i18n.t('units.third'), plural: i18n.t('units.third_plural') },
    { id: 26, singular: i18n.t('units.twist'), plural: i18n.t('units.twist_plural') },
    { id: 27, singular: i18n.t('units.wedge'), plural: i18n.t('units.wedge_plural') },
  ];
}

export function getCocktailUnitDictionary(): Record<number, CocktailUnit> {
  return getMeasureUnits().reduce(
    (dictionary, unit) => {
      dictionary[unit.id] = {
        ...unit,
        singular: unit.singular.trim(),
        plural: unit.plural?.trim() || undefined,
      };
      return dictionary;
    },
    {} as Record<number, CocktailUnit>,
  );
}

export function getCocktailUnitOptions(): { id: number; label: string }[] {
  return getMeasureUnits().map((unit) => ({
    id: unit.id,
    label: unit.singular.trim(),
  }));
}

export function getCocktailUnitLabel(unitId?: number | null): string | undefined {
  if (unitId == null) {
    return undefined;
  }
  const dictionary = getCocktailUnitDictionary();
  const entry = dictionary[unitId];
  const label = entry?.singular.trim();
  return label || undefined;
}
