import { MaterialCommunityIcons } from '@expo/vector-icons';
import { type ImageSource } from 'expo-image';
import { type ComponentProps } from 'react';

import ShakerIcon from '@/assets/images/shaker.svg';

import type { CocktailMethodId } from './cocktail-methods';

export type MethodIcon =
  | { type: 'icon'; name: ComponentProps<typeof MaterialCommunityIcons>['name'] }
  | { type: 'asset'; source: ImageSource };

export const METHOD_ICON_MAP: Record<CocktailMethodId, MethodIcon> = {
  build: { type: 'icon', name: 'beer' },
  stir: { type: 'icon', name: 'delete-variant' },
  shake: { type: 'asset', source: ShakerIcon },
  muddle: { type: 'icon', name: 'bottle-soda' },
  layer: { type: 'icon', name: 'layers' },
  blend: { type: 'icon', name: 'blender' },
  throwing: { type: 'icon', name: 'swap-horizontal' },
};
