import { loadInventoryData } from '@/libs/inventory-data';

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

export function getCocktailMethods(): CocktailMethod[] {
  return loadInventoryData().cocktailMethods;
}

export const COCKTAIL_METHODS: CocktailMethod[] = getCocktailMethods();

export function getCocktailMethodById(id?: string | null): CocktailMethod | undefined {
  if (!id) {
    return undefined;
  }
  return getCocktailMethods().find((method) => method.id === id);
}
