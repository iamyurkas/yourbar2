import { type CocktailMethodId } from "@/constants/cocktail-methods";
import type { SupportedLocale } from "@/libs/i18n/types";
import { type InventoryData } from "@/libs/inventory-data";

export type BaseCocktailRecord = InventoryData["cocktails"][number];
export type BaseIngredientRecord = InventoryData["ingredients"][number];

export type CocktailTag = {
  id: number;
  name: string;
  color: string;
};

export type IngredientTag = {
  id: number;
  name: string;
  color: string;
};

type CocktailIngredientRecord = NonNullable<
  BaseCocktailRecord["ingredients"]
>[number] & {
  optional?: boolean | null;
  garnish?: boolean | null;
  process?: boolean | null;
  serving?: boolean | null;
  photoUri?: string | null;
  tags?: IngredientTag[] | null;
  substitutes?: Array<{
    ingredientId?: number | null;
    name?: string | null;
    brand?: boolean | null;
    amount?: string | null;
    unitId?: number | null;
    unit?: string | null;
  }> | null;
};

type CocktailSubstituteRecord = NonNullable<
  NonNullable<CocktailIngredientRecord["substitutes"]>[number]
>;

export type IngredientRecord = Omit<BaseIngredientRecord, "tags"> & {
  ingredientKind?: "ice" | null;
  tags?: IngredientTag[] | null;
  synonyms?: string[] | null;
  styleIngredientId?: number | null;
  imageUrl?: string | null;
  abv?: number | null;
  barcodes?: string[] | null;
};

export type CocktailSubstitute = CocktailSubstituteRecord & { brand?: boolean };
export type CocktailIngredient = Omit<
  CocktailIngredientRecord,
  "substitutes" | "ingredientId" | "name" | "amount" | "unitId"
> & {
  ingredientId?: number;
  name?: string;
  amount?: string;
  unitId?: number;
  allowBaseSubstitution?: boolean;
  allowBrandSubstitution?: boolean;
  allowStyleSubstitution?: boolean;
  substitutes?: CocktailSubstitute[];
};

type CocktailRecord = Omit<
  BaseCocktailRecord,
  "ingredients" | "searchName" | "searchTokens" | "tags"
> & {
  ingredients?: CocktailIngredient[];
  tags?: CocktailTag[] | null;
  searchName?: string | null;
  searchTokens?: string[] | null;
  methodId?: CocktailMethodId | null;
  methodIds?: CocktailMethodId[] | null;
};

export type PhotoBackupEntry = {
  type: "cocktails" | "ingredients";
  id?: number | string | null;
  name?: string | null;
  uri?: string | null;
};

export type ImportedPhotoEntry = {
  type: "cocktails" | "ingredients";
  id: number;
  photoUri: string;
};

type NormalizedSearchFields = {
  searchNameNormalized: string;
  searchTokensNormalized: string[];
};

export type Cocktail = CocktailRecord &
  NormalizedSearchFields & { userRating?: number };
export type Ingredient = IngredientRecord & NormalizedSearchFields;

export type Bar = {
  id: string;
  name: string;
  availableIngredientIds: number[];
  shoppingIngredientIds: number[];
};

export type StartScreen =
  | "cocktails_all"
  | "cocktails_my"
  | "shaker"
  | "ingredients_all"
  | "ingredients_my"
  | "ingredients_shopping";

export type AppTheme = "light" | "dark" | "system";
export type AppLocale = "de-DE" | "en-GB" | "en-US" | "es-ES" | "uk-UA";

export type GoogleUser = {
  id: string;
  email: string;
  name?: string;
  picture?: string;
};

export type SyncState = 'idle' | 'signing_in' | 'syncing' | 'error';

export type SyncStatus = {
  syncState: SyncState;
  isSyncing: boolean;
  lastSyncTime?: string | null;
  syncError?: string | null;
  googleUser?: GoogleUser | null;
};

export type CreateCocktailSubstituteInput = {
  ingredientId?: number | string | null;
  name?: string | null;
  brand?: boolean | null;
  amount?: string | null;
  unitId?: number | string | null;
  unit?: string | null;
};

export type CreateCocktailIngredientInput = {
  ingredientId?: number | string | null;
  name?: string | null;
  amount?: string | null;
  unitId?: number | string | null;
  optional?: boolean | null;
  garnish?: boolean | null;
  process?: boolean | null;
  serving?: boolean | null;
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
  video?: string | null;
  synonyms?: string[] | null;
  photoUri?: string | null;
  glassId?: string | null;
  methodIds?: CocktailMethodId[] | null;
  tags?: CocktailTag[] | null;
  defaultServings?: number | null;
  ingredients: CreateCocktailIngredientInput[];
};

export type CreateIngredientInput = {
  name: string;
  description?: string | null;
  synonyms?: string[] | null;
  photoUri?: string | null;
  imageUrl?: string | null;
  abv?: number | null;
  barcodes?: string[] | null;
  baseIngredientId?: number | null;
  styleIngredientId?: number | null;
  tags?: IngredientTag[] | null;
};

export type CocktailStorageRecord = Omit<
  CocktailRecord,
  "searchName" | "searchTokens"
>;
export type IngredientStorageRecord = Omit<
  IngredientRecord,
  "searchName" | "searchTokens"
>;

export type InventoryExportData = {
  cocktails: Array<
    Omit<CocktailStorageRecord, "tags"> & { tags?: number[] | null }
  >;
  ingredients: Array<
    Omit<IngredientStorageRecord, "tags"> & { tags?: number[] | null }
  >;
  cocktailFeedback?: Record<string, { rating?: number; comment?: string }>;
  ingredientStatus?: Record<
    string,
    { available?: boolean; shopping?: boolean }
  >;
};

export type InventoryImportOptions = {
  importIngredientAvailability?: boolean;
  importIngredientShopping?: boolean;
};

export type CocktailTranslationOverride = {
  name?: string;
  description?: string;
  instructions?: string;
  video?: string;
  synonyms?: string[];
};

export type IngredientTranslationOverride = {
  name?: string;
  description?: string;
  synonyms?: string[];
};

export type InventoryLocaleTranslationOverrides = {
  cocktails?: Record<string, CocktailTranslationOverride>;
  ingredients?: Record<string, IngredientTranslationOverride>;
};

export type InventoryTranslationOverrides = Partial<
  Record<SupportedLocale, InventoryLocaleTranslationOverrides>
>;

export type InventoryBaseExportFile = {
  schemaVersion: 1;
  kind: "base";
  data: InventoryExportData;
};

export type InventoryTranslationsExportFile = {
  schemaVersion: 1;
  kind: "translations";
  locale: SupportedLocale;
  data: InventoryLocaleTranslationOverrides;
};

export type InventoryExportFile =
  | InventoryBaseExportFile
  | InventoryTranslationsExportFile;
