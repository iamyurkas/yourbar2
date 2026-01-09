export type CocktailMethodId =
  | 'build'
  | 'stir'
  | 'shake'
  | 'muddle'
  | 'layer'
  | 'blend'
  | 'throwing';

export type CocktailMethod = {
  id: CocktailMethodId;
  label: string;
  title: string;
  description: string;
};

export const COCKTAIL_METHODS: CocktailMethod[] = [
  {
    id: 'build',
    label: 'Build (Білд)',
    title: 'Побудова',
    description: 'Pour ingredients directly into the serving glass.',
  },
  {
    id: 'stir',
    label: 'Stir (Стір)',
    title: 'Перемішування',
    description: 'Stir with a bar spoon in a mixing glass full of ice.',
  },
  {
    id: 'shake',
    label: 'Shake (Шейк)',
    title: 'Збивання',
    description:
      'Shake hard with ice. Best for citrus, syrup, cream, or egg white to aerate and chill.',
  },
  {
    id: 'muddle',
    label: 'Muddle (Мадлінг)',
    title: 'Розтирання',
    description:
      'Press fruit, berries, or herbs to release oils and juice.',
  },
  {
    id: 'layer',
    label: 'Layer (Лейєринг)',
    title: 'Нашарування',
    description:
      'Float ingredients in layers using a bar spoon for visual effect.',
  },
  {
    id: 'blend',
    label: 'Blend (Бленд)',
    title: 'Збивання в блендері',
    description: 'Blend with crushed ice into a frozen texture.',
  },
  {
    id: 'throwing',
    label: 'Throwing (Троуінг)',
    title: 'Переливання',
    description:
      'Pour between tins from a distance to aerate without cloudiness.',
  },
];

export function getCocktailMethodById(id?: string | null): CocktailMethod | undefined {
  if (!id) {
    return undefined;
  }
  return COCKTAIL_METHODS.find((method) => method.id === id);
}
