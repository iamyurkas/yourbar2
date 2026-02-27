import { type CocktailMethodId } from '@/constants/cocktail-methods';
import { type InventoryData } from '@/libs/inventory-data';

export type BaseCocktailRecord = InventoryData['cocktails'][number];
export type BaseIngredientRecord = InventoryData['ingredients'][number];
type CocktailIngredientRecord = NonNullable<BaseCocktailRecord['ingredients']>[number];
type CocktailSubstituteRecord = NonNullable<CocktailIngredientRecord['substitutes']>[number];
type IngredientRecord = BaseIngredientRecord & {
  styleIngredientId?: number | null;
};
export type CocktailTag = NonNullable<BaseCocktailRecord['tags']>[number];
export type CocktailSubstitute = CocktailSubstituteRecord & { brand?: boolean };
export type CocktailIngredient = Omit<CocktailIngredientRecord, 'substitutes'> & {
  allowBaseSubstitution?: boolean;
  allowBrandSubstitution?: boolean;
  allowStyleSubstitution?: boolean;
  substitutes?: CocktailSubstitute[];
};
type CocktailRecord = Omit<BaseCocktailRecord, 'ingredients' | 'searchName' | 'searchTokens'> & {
  ingredients?: CocktailIngredient[];
  searchName?: string | null;
  searchTokens?: string[] | null;
  methodId?: CocktailMethodId | null;
  methodIds?: CocktailMethodId[] | null;
};
export type PhotoBackupEntry = {
  type: 'cocktails' | 'ingredients';
  id?: number | string | null;
  name?: string | null;
  uri?: string | null;
};


export type ImportedPhotoEntry = {
  type: 'cocktails' | 'ingredients';
  id: number;
  photoUri: string;
};

type NormalizedSearchFields = {
  searchNameNormalized: string;
  searchTokensNormalized: string[];
};

export type Cocktail = CocktailRecord & NormalizedSearchFields & { userRating?: number };
export type Ingredient = IngredientRecord & NormalizedSearchFields;
export type StartScreen =
  | 'cocktails_all'
  | 'cocktails_my'
  | 'cocktails_favorites'
  | 'shaker'
  | 'ingredients_all'
  | 'ingredients_my'
  | 'ingredients_shopping';

export type AppTheme = 'light' | 'dark' | 'system';
export type AppLocale = 'en-GB' | 'en-US' | 'uk-UA';

export type IngredientTag = NonNullable<IngredientRecord['tags']>[number];

export type CreateCocktailSubstituteInput = {
  ingredientId?: number | string | null;
  name?: string | null;
  brand?: boolean | null;
};

export type CreateCocktailIngredientInput = {
  ingredientId?: number | string | null;
  name?: string | null;
  amount?: string | null;
  unitId?: number | string | null;
  optional?: boolean | null;
  garnish?: boolean | null;
  allowBaseSubstitution?: boolean | null;
  allowBrandSubstitution?: boolean | null;
  allowStyleSubstitution?: boolean | null;
  substitutes?: CreateCocktailSubstituteInput[] | null;
  order: number;
};

export type CreateCocktailInput = {
  name: string;
  description?: string | null;
  instructions?: string | null;
  synonyms?: string[] | null;
  photoUri?: string | null;
  glassId?: string | null;
  methodIds?: CocktailMethodId[] | null;
  tags?: CocktailTag[] | null;
  ingredients: CreateCocktailIngredientInput[];
};

export type CreateIngredientInput = {
  name: string;
  description?: string | null;
  photoUri?: string | null;
  baseIngredientId?: number | null;
  styleIngredientId?: number | null;
  tags?: IngredientTag[] | null;
};

export type CocktailStorageRecord = Omit<CocktailRecord, 'searchName' | 'searchTokens'>;
export type IngredientStorageRecord = Omit<IngredientRecord, 'searchName' | 'searchTokens'>;

export type InventoryExportData = {
  cocktails: Array<Omit<CocktailStorageRecord, 'tags'> & { tags?: number[] | null }>;
  ingredients: Array<Omit<IngredientStorageRecord, 'tags'> & { tags?: number[] | null }>;
};

export type InventoryTranslationExportData = {
  locale: AppLocale;
  cocktails: Array<{
    id: number;
    name?: string;
    description?: string;
    instructions?: string;
    synonyms?: string[];
    ingredients?: Array<{
      ingredientId?: number;
      name: string;
    }>;
  }>;
  ingredients: Array<{
    id: number;
    name?: string;
    description?: string;
    synonyms?: string[];
  }>;
};
