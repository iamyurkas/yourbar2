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
    label: 'Build',
    title: 'Build',
    description: 'Pour ingredients directly into the serving glass.',
  },
  {
    id: 'stir',
    label: 'Stir',
    title: 'Stir',
    description: 'Stir with a bar spoon in a mixing glass full of ice.',
  },
  {
    id: 'shake',
    label: 'Shake',
    title: 'Shake',
    description:
      'Shake with ice. Best for citrus, syrup, cream, or egg white to aerate and chill.',
  },
  {
    id: 'muddle',
    label: 'Muddle',
    title: 'Muddle',
    description:
      'Press fruit, berries, or herbs to release oils and juice.',
  },
  {
    id: 'layer',
    label: 'Layer',
    title: 'Layer',
    description:
      'Float ingredients in layers using a bar spoon for visual effect.',
  },
  {
    id: 'blend',
    label: 'Blend',
    title: 'Blend',
    description: 'Blend with crushed ice into a frozen texture.',
  },
  {
    id: 'throwing',
    label: 'Throwing',
    title: 'Throwing',
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
