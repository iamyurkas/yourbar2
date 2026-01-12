import { MaterialCommunityIcons } from '@expo/vector-icons';
import { type ImageSource } from 'expo-image';
import { type ComponentProps } from 'react';

import ShakerIcon from '@/assets/images/shaker.svg';
import { loadInventoryData } from '@/libs/inventory-data';

export type CocktailMethod = {
  id: CocktailMethodId;
  label: string;
  title: string;
  description: string;
};

export type MethodIcon =
  | { type: 'icon'; name: ComponentProps<typeof MaterialCommunityIcons>['name'] }
  | { type: 'asset'; source: ImageSource };

export function getCocktailMethods(): CocktailMethod[] {
  return loadInventoryData().cocktailMethods;
}

export const COCKTAIL_METHODS: CocktailMethod[] = getCocktailMethods();

export const METHOD_ICON_MAP = {
  blend: { type: 'icon', name: 'blender' },
  muddle: { type: 'icon', name: 'bottle-soda' },
  shake: { type: 'asset', source: ShakerIcon },
  stir: { type: 'icon', name: 'delete-variant' },
  throwing: { type: 'icon', name: 'swap-horizontal' },
  build: { type: 'icon', name: 'beer' },
  layer: { type: 'icon', name: 'layers' },
} as const satisfies Record<string, MethodIcon>;

export type CocktailMethodId = keyof typeof METHOD_ICON_MAP;

export function getCocktailMethodById(id?: string | null): CocktailMethod | undefined {
  if (!id) {
    return undefined;
  }
  return getCocktailMethods().find((method) => method.id === id);
}
