import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ImageSource } from 'expo-image';
import type { ComponentProps } from 'react';

import ShakerIcon from '@/assets/images/shaker.svg';

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

export type MethodIcon =
  | { type: 'icon'; name: ComponentProps<typeof MaterialCommunityIcons>['name'] }
  | { type: 'asset'; source: ImageSource };

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
    description: 'Shake with ice. Best for citrus, syrup, cream, or egg white to aerate and chill.',
  },
  {
    id: 'muddle',
    label: 'Muddle',
    title: 'Muddle',
    description: 'Press fruit, berries, or herbs to release oils and juice.',
  },
  {
    id: 'layer',
    label: 'Layer',
    title: 'Layer',
    description: 'Float ingredients in layers using a bar spoon for visual effect.',
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
    description: 'Pour between tins from a distance to aerate without cloudiness.',
  },
];

export const METHOD_ICON_MAP: Record<CocktailMethodId, MethodIcon> = {
  build: { type: 'icon', name: 'beer' },
  stir: { type: 'icon', name: 'delete-variant' },
  shake: { type: 'asset', source: ShakerIcon },
  muddle: { type: 'icon', name: 'bottle-soda' },
  layer: { type: 'icon', name: 'layers' },
  blend: { type: 'icon', name: 'blender' },
  throwing: { type: 'icon', name: 'swap-horizontal' },
};

export function getCocktailMethods(): CocktailMethod[] {
  return COCKTAIL_METHODS;
}

export function getCocktailMethodById(id?: string | null): CocktailMethod | undefined {
  if (!id) {
    return undefined;
  }
  return getCocktailMethods().find((method) => method.id === id);
}
