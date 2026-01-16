import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { BUILTIN_COCKTAIL_TAGS } from '@/constants/cocktail-tags';
import { type CocktailMethodId } from '@/constants/cocktail-methods';
import { BUILTIN_INGREDIENT_TAGS } from '@/constants/ingredient-tags';
import { TAG_COLORS } from '@/constants/tag-colors';
import { loadInventoryData, reloadInventoryData, type InventoryData } from '@/libs/inventory-data';
import {
  clearInventorySnapshot,
  loadInventorySnapshot,
  persistInventorySnapshot,
  type InventoryDeltaSnapshot,
  type InventorySnapshot,
} from '@/libs/inventory-storage';
import { buildPhotoBaseName } from '@/libs/photo-utils';
import { normalizeSearchText } from '@/libs/search-normalization';

type BaseCocktailRecord = InventoryData['cocktails'][number];
type CocktailIngredientRecord = NonNullable<BaseCocktailRecord['ingredients']>[number];
type CocktailSubstituteRecord = NonNullable<CocktailIngredientRecord['substitutes']>[number];
type CocktailTag = NonNullable<BaseCocktailRecord['tags']>[number];
type CocktailSubstitute = CocktailSubstituteRecord & { brand?: boolean };
type CocktailIngredient = Omit<CocktailIngredientRecord, 'substitutes'> & {
  allowBaseSubstitution?: boolean;
  allowBrandSubstitution?: boolean;
  substitutes?: CocktailSubstitute[];
};
type CocktailRecord = Omit<BaseCocktailRecord, 'ingredients' | 'searchName' | 'searchTokens'> & {
  ingredients?: CocktailIngredient[];
  searchName?: string | null;
  searchTokens?: string[] | null;
  methodId?: CocktailMethodId | null;
  methodIds?: CocktailMethodId[] | null;
};
type IngredientRecord = InventoryData['ingredients'][number];
type PhotoBackupEntry = {
  type: 'cocktails' | 'ingredients';
  id?: number | string | null;
  name?: string | null;
  uri?: string | null;
};

type NormalizedSearchFields = {
  searchNameNormalized: string;
  searchTokensNormalized: string[];
};

type Cocktail = CocktailRecord & NormalizedSearchFields & { userRating?: number };
type Ingredient = IngredientRecord & NormalizedSearchFields;
export type StartScreen =
  | 'cocktails_all'
  | 'cocktails_my'
  | 'cocktails_favorites'
  | 'shaker'
  | 'ingredients_all'
  | 'ingredients_my'
  | 'ingredients_shopping';
const DEFAULT_START_SCREEN: StartScreen = 'cocktails_all';

type InventoryContextValue = {
  cocktails: Cocktail[];
  ingredients: Ingredient[];
  loading: boolean;
  availableIngredientIds: Set<number>;
  shoppingIngredientIds: Set<number>;
  customCocktailTags: CocktailTag[];
  customIngredientTags: IngredientTag[];
  ignoreGarnish: boolean;
  allowAllSubstitutes: boolean;
  useImperialUnits: boolean;
  keepScreenAwake: boolean;
  ratingFilterThreshold: number;
  hasSeenIngredientsOnboarding: boolean;
  setIngredientAvailability: (id: number, available: boolean) => void;
  toggleIngredientAvailability: (id: number) => void;
  toggleIngredientShopping: (id: number) => void;
  clearBaseIngredient: (id: number) => void;
  createCocktail: (input: CreateCocktailInput) => Cocktail | undefined;
  createIngredient: (input: CreateIngredientInput) => Ingredient | undefined;
  resetInventoryFromBundle: () => Promise<void>;
  exportInventoryData: () => InventoryData | null;
  exportInventoryPhotoEntries: () => PhotoBackupEntry[] | null;
  importInventoryData: (data: InventoryData) => void;
  updateIngredient: (id: number, input: CreateIngredientInput) => Ingredient | undefined;
  updateCocktail: (id: number, input: CreateCocktailInput) => Cocktail | undefined;
  deleteCocktail: (id: number) => boolean;
  deleteIngredient: (id: number) => boolean;
  createCustomCocktailTag: (input: { name: string; color?: string | null }) => CocktailTag | undefined;
  updateCustomCocktailTag: (id: number, input: { name: string; color?: string | null }) => CocktailTag | undefined;
  deleteCustomCocktailTag: (id: number) => boolean;
  createCustomIngredientTag: (input: { name: string; color?: string | null }) => IngredientTag | undefined;
  updateCustomIngredientTag: (id: number, input: { name: string; color?: string | null }) => IngredientTag | undefined;
  deleteCustomIngredientTag: (id: number) => boolean;
  cocktailRatings: Record<string, number>;
  setCocktailRating: (cocktail: Cocktail, rating: number) => void;
  getCocktailRating: (cocktail: Cocktail) => number;
  setIgnoreGarnish: (value: boolean) => void;
  setAllowAllSubstitutes: (value: boolean) => void;
  setUseImperialUnits: (value: boolean) => void;
  setKeepScreenAwake: (value: boolean) => void;
  setRatingFilterThreshold: (value: number) => void;
  startScreen: StartScreen;
  setStartScreen: (value: StartScreen) => void;
  setHasSeenIngredientsOnboarding: (value: boolean) => void;
};

type InventoryState = {
  cocktails: Cocktail[];
  ingredients: Ingredient[];
  imported: boolean;
};

type IngredientTag = NonNullable<IngredientRecord['tags']>[number];

type CreateCocktailSubstituteInput = {
  id?: number | string | null;
  ingredientId?: number | string | null;
  name?: string | null;
  brand?: boolean | null;
};

type CreateCocktailIngredientInput = {
  ingredientId?: number | string | null;
  name?: string | null;
  amount?: string | null;
  unitId?: number | string | null;
  optional?: boolean | null;
  garnish?: boolean | null;
  allowBaseSubstitution?: boolean | null;
  allowBrandSubstitution?: boolean | null;
  substitutes?: CreateCocktailSubstituteInput[] | null;
  order?: number | null;
};

type CreateCocktailInput = {
  name: string;
  description?: string | null;
  instructions?: string | null;
  photoUri?: string | null;
  glassId?: string | null;
  methodIds?: CocktailMethodId[] | null;
  tags?: CocktailTag[] | null;
  ingredients: CreateCocktailIngredientInput[];
};

type CreateIngredientInput = {
  name: string;
  description?: string | null;
  photoUri?: string | null;
  baseIngredientId?: number | null;
  tags?: IngredientTag[] | null;
};

type CocktailStorageRecord = Omit<CocktailRecord, 'searchName' | 'searchTokens'>;
type IngredientStorageRecord = Omit<IngredientRecord, 'searchName' | 'searchTokens'>;

const INVENTORY_SNAPSHOT_VERSION = 2;

declare global {
  // eslint-disable-next-line no-var
  var __yourbarInventory: InventoryState | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryAvailableIngredientIds: Set<number> | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryShoppingIngredientIds: Set<number> | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryCocktailRatings: Record<string, number> | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryIgnoreGarnish: boolean | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryAllowAllSubstitutes: boolean | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryUseImperialUnits: boolean | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryKeepScreenAwake: boolean | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryRatingFilterThreshold: number | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryStartScreen: StartScreen | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryHasSeenIngredientsOnboarding: boolean | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryCustomCocktailTags: CocktailTag[] | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryCustomIngredientTags: IngredientTag[] | undefined;
}

function normalizeSearchFields<T extends { name?: string | null; searchName?: string | null; searchTokens?: string[] | null }>(
  items: readonly T[] = [],
): (T & NormalizedSearchFields)[] {
  return items.map((item) => {
    const { searchName: _searchName, searchTokens: _searchTokens, ...rest } = item;
    const baseName = item.name ?? '';
    const searchNameNormalized = normalizeSearchText(baseName);
    const searchTokensNormalized = searchNameNormalized
      .split(/\s+/)
      .map((token) => normalizeSearchText(token))
      .filter(Boolean);

    return {
      ...rest,
      searchNameNormalized,
      searchTokensNormalized,
    };
  });
}

function createInventoryStateFromData(data: InventoryData, imported: boolean): InventoryState {
  return {
    cocktails: normalizeSearchFields(data.cocktails) as Cocktail[],
    ingredients: normalizeSearchFields(data.ingredients) as Ingredient[],
    imported,
  } satisfies InventoryState;
}

function normalizeTagList<TTag extends { id?: number | null; name?: string | null; color?: string | null }>(
  tags: readonly TTag[] | null | undefined,
): Array<{ id: number; name: string; color?: string | null }> | undefined {
  if (!tags || tags.length === 0) {
    return undefined;
  }

  return tags
    .map((tag) => ({
      id: Number(tag.id ?? -1),
      name: tag.name?.trim() ?? '',
      color: tag.color ?? undefined,
    }))
    .filter((tag) => Number.isFinite(tag.id) && tag.id >= 0 && tag.name)
    .map((tag) => ({
      id: Math.trunc(tag.id),
      name: tag.name,
      color: tag.color,
    }))
    .sort((a, b) => a.id - b.id || a.name.localeCompare(b.name));
}

function normalizeSubstitutes(substitutes: readonly CocktailSubstitute[] | null | undefined): CocktailSubstitute[] | undefined {
  if (!substitutes || substitutes.length === 0) {
    return undefined;
  }

  return substitutes
    .map((substitute) => ({
      id: substitute.id != null ? Math.trunc(Number(substitute.id)) : undefined,
      ingredientId: substitute.ingredientId != null ? Math.trunc(Number(substitute.ingredientId)) : undefined,
      name: substitute.name,
      brand: substitute.brand,
    }))
    .filter((substitute) => substitute.name && Number.isFinite(Number(substitute.id ?? substitute.ingredientId ?? -1)))
    .sort((a, b) => {
      const aId = a.id ?? a.ingredientId ?? -1;
      const bId = b.id ?? b.ingredientId ?? -1;
      return aId - bId || a.name.localeCompare(b.name);
    });
}

function normalizeCocktailIngredients(
  ingredients: readonly CocktailIngredient[] | null | undefined,
): CocktailIngredient[] | undefined {
  if (!ingredients || ingredients.length === 0) {
    return undefined;
  }

  return ingredients
    .map((ingredient) => ({
      order: ingredient.order != null ? Math.trunc(Number(ingredient.order)) : undefined,
      ingredientId: ingredient.ingredientId != null ? Math.trunc(Number(ingredient.ingredientId)) : undefined,
      name: ingredient.name,
      amount: ingredient.amount ?? undefined,
      unitId: ingredient.unitId != null ? Math.trunc(Number(ingredient.unitId)) : undefined,
      optional: ingredient.optional ? true : undefined,
      garnish: ingredient.garnish ? true : undefined,
      allowBaseSubstitution: ingredient.allowBaseSubstitution ? true : undefined,
      allowBrandSubstitution: ingredient.allowBrandSubstitution ? true : undefined,
      substitutes: normalizeSubstitutes(ingredient.substitutes),
    }))
    .filter((ingredient) => ingredient.name)
    .sort((a, b) => {
      const orderDelta = (a.order ?? 0) - (b.order ?? 0);
      return orderDelta !== 0 ? orderDelta : a.name.localeCompare(b.name);
    });
}

function toCocktailStorageRecord(cocktail: Cocktail | BaseCocktailRecord): CocktailStorageRecord {
  const normalizedTags = normalizeTagList(cocktail.tags);
  const normalizedIngredients = normalizeCocktailIngredients(cocktail.ingredients);

  return {
    id: cocktail.id,
    name: cocktail.name,
    description: cocktail.description ?? undefined,
    instructions: cocktail.instructions ?? undefined,
    photoUri: cocktail.photoUri ?? undefined,
    glassId: cocktail.glassId ?? undefined,
    methodIds: 'methodIds' in cocktail ? cocktail.methodIds ?? undefined : undefined,
    tags: normalizedTags && normalizedTags.length > 0 ? normalizedTags : undefined,
    ingredients: normalizedIngredients && normalizedIngredients.length > 0 ? normalizedIngredients : undefined,
    createdAt: 'createdAt' in cocktail ? cocktail.createdAt : undefined,
    updatedAt: 'updatedAt' in cocktail ? cocktail.updatedAt : undefined,
  } satisfies CocktailStorageRecord;
}

function toIngredientStorageRecord(ingredient: Ingredient | IngredientRecord): IngredientStorageRecord {
  const normalizedTags = normalizeTagList(ingredient.tags);

  return {
    id: ingredient.id,
    name: ingredient.name,
    description: ingredient.description ?? undefined,
    tags: normalizedTags && normalizedTags.length > 0 ? normalizedTags : undefined,
    baseIngredientId: ingredient.baseIngredientId ?? undefined,
    usageCount: ingredient.usageCount ?? undefined,
    photoUri: ingredient.photoUri ?? undefined,
  } satisfies IngredientStorageRecord;
}

const BACKUP_PHOTO_URI_PATTERN = /\/photos\/(cocktails|ingredients)\/([^/]+)$/;

type PhotoBackupContext = {
  uri?: string | null;
  category: 'cocktails' | 'ingredients';
  id?: number | string | null;
  name?: string | null;
};

function normalizePhotoUriForBackup({
  uri,
  category,
  id,
  name,
}: PhotoBackupContext): string | undefined {
  if (!uri) {
    return undefined;
  }

  if (uri.startsWith('assets/')) {
    return uri;
  }

  const match = uri.match(BACKUP_PHOTO_URI_PATTERN);
  if (!match) {
    return uri;
  }

  const baseName = buildPhotoBaseName(id ?? 'photo', name ?? 'photo');
  return `assets/${category}/${baseName}.jpg`;
}

function areStorageRecordsEqual<TRecord>(left: TRecord, right: TRecord): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function applyDeltaToCollection<TRecord extends { id?: number | null }>(
  baseItems: readonly TRecord[],
  delta?: { created?: TRecord[]; updated?: TRecord[]; deletedIds?: number[] },
): TRecord[] {
  if (!delta) {
    return [...baseItems];
  }

  const deletedSet = new Set(
    (delta.deletedIds ?? [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id >= 0)
      .map((id) => Math.trunc(id)),
  );

  const updatedMap = new Map<number, TRecord>();
  (delta.updated ?? []).forEach((record) => {
    const id = Number(record.id ?? -1);
    if (!Number.isFinite(id) || id < 0) {
      return;
    }
    updatedMap.set(Math.trunc(id), record);
  });

  const createdMap = new Map<number, TRecord>();
  (delta.created ?? []).forEach((record) => {
    const id = Number(record.id ?? -1);
    if (!Number.isFinite(id) || id < 0) {
      return;
    }
    createdMap.set(Math.trunc(id), record);
  });

  const next: TRecord[] = [];
  const seen = new Set<number>();

  baseItems.forEach((record) => {
    const id = Number(record.id ?? -1);
    if (!Number.isFinite(id) || id < 0) {
      return;
    }
    const normalizedId = Math.trunc(id);
    if (deletedSet.has(normalizedId)) {
      return;
    }

    const replacement = updatedMap.get(normalizedId) ?? createdMap.get(normalizedId);
    next.push(replacement ?? record);
    seen.add(normalizedId);
  });

  updatedMap.forEach((record, id) => {
    if (seen.has(id) || deletedSet.has(id)) {
      return;
    }
    next.push(record);
    seen.add(id);
  });

  createdMap.forEach((record, id) => {
    if (seen.has(id) || deletedSet.has(id)) {
      return;
    }
    next.push(record);
    seen.add(id);
  });

  return next;
}

function applyDeltaToInventoryData(
  baseData: InventoryData,
  delta: InventoryDeltaSnapshot<CocktailStorageRecord, IngredientStorageRecord>['delta'],
): InventoryData {
  return {
    ...baseData,
    cocktails: applyDeltaToCollection(baseData.cocktails, delta.cocktails),
    ingredients: applyDeltaToCollection(baseData.ingredients, delta.ingredients),
  };
}

function createInventoryStateFromSnapshot(
  snapshot: InventorySnapshot<CocktailStorageRecord, IngredientStorageRecord>,
  baseData: InventoryData,
): InventoryState {
  if ('delta' in snapshot) {
    const mergedData = applyDeltaToInventoryData(baseData, snapshot.delta);
    return createInventoryStateFromData(mergedData, Boolean(snapshot.imported));
  }

  return {
    cocktails: normalizeSearchFields(snapshot.cocktails) as Cocktail[],
    ingredients: normalizeSearchFields(snapshot.ingredients) as Ingredient[],
    imported: Boolean(snapshot.imported),
  } satisfies InventoryState;
}

function toSortedArray(values: Iterable<number>): number[] {
  const sanitized = Array.from(values)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.trunc(value));

  return Array.from(new Set(sanitized)).sort((a, b) => a - b);
}

function sanitizeCocktailRatings(
  ratings?: Record<string, number> | null | undefined,
): Record<string, number> {
  if (!ratings) {
    return {};
  }

  const sanitized: Record<string, number> = {};
  Object.entries(ratings).forEach(([key, value]) => {
    const normalized = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
    if (normalized > 0) {
      sanitized[key] = normalized;
    }
  });
  return sanitized;
}

function createIngredientIdSet(values?: readonly number[] | null): Set<number> {
  if (!values || values.length === 0) {
    return new Set<number>();
  }

  const sanitized = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.trunc(value));

  return new Set(sanitized);
}

function sanitizeStartScreen(value?: string | null): StartScreen {
  switch (value) {
    case 'cocktails_all':
    case 'cocktails_my':
    case 'cocktails_favorites':
    case 'shaker':
    case 'ingredients_all':
    case 'ingredients_my':
    case 'ingredients_shopping':
      return value;
    default:
      return DEFAULT_START_SCREEN;
  }
}

const DEFAULT_TAG_COLOR = TAG_COLORS[0];
const BUILTIN_COCKTAIL_TAG_MAX = BUILTIN_COCKTAIL_TAGS.reduce((max, tag) => Math.max(max, tag.id), 0);
const BUILTIN_INGREDIENT_TAG_MAX = BUILTIN_INGREDIENT_TAGS.reduce((max, tag) => Math.max(max, tag.id), 0);

function sanitizeCustomTags<TTag extends { id?: number | null; name?: string | null; color?: string | null }>(
  tags: readonly TTag[] | null | undefined,
  fallbackColor: string,
): Array<{ id: number; name: string; color: string }> {
  if (!tags || tags.length === 0) {
    return [];
  }

  const map = new Map<number, { id: number; name: string; color: string }>();

  tags.forEach((tag) => {
    const rawId = Number(tag.id ?? -1);
    if (!Number.isFinite(rawId) || rawId < 0) {
      return;
    }

    const name = tag.name?.trim();
    if (!name) {
      return;
    }

    const color = typeof tag.color === 'string' && tag.color.trim() ? tag.color : fallbackColor;
    map.set(rawId, { id: Math.trunc(rawId), name, color });
  });

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function getNextCustomTagId(tags: readonly { id?: number | null }[], minimum: number): number {
  const maxId = tags.reduce((max, tag) => {
    const id = Number(tag.id ?? -1);
    if (!Number.isFinite(id) || id < 0) {
      return max;
    }
    return Math.max(max, Math.trunc(id));
  }, minimum);

  return maxId + 1;
}

function createDeltaSnapshotFromInventory(
  state: InventoryState,
  options: {
    availableIngredientIds: Set<number>;
    shoppingIngredientIds: Set<number>;
    cocktailRatings: Record<string, number>;
    ignoreGarnish: boolean;
    allowAllSubstitutes: boolean;
    useImperialUnits: boolean;
    keepScreenAwake: boolean;
    ratingFilterThreshold: number;
    startScreen: StartScreen;
    hasSeenIngredientsOnboarding: boolean;
    customCocktailTags: CocktailTag[];
    customIngredientTags: IngredientTag[];
  },
): InventoryDeltaSnapshot<CocktailStorageRecord, IngredientStorageRecord> {
  const baseData = loadInventoryData();
  const baseCocktails = new Map<number, CocktailStorageRecord>(
    baseData.cocktails
      .map((cocktail) => {
        const normalized = toCocktailStorageRecord(cocktail);
        const id = Number(normalized.id ?? -1);
        if (!Number.isFinite(id) || id < 0) {
          return undefined;
        }
        return [Math.trunc(id), normalized] as const;
      })
      .filter((entry): entry is readonly [number, CocktailStorageRecord] => Boolean(entry)),
  );
  const baseIngredients = new Map<number, IngredientStorageRecord>(
    baseData.ingredients
      .map((ingredient) => {
        const normalized = toIngredientStorageRecord(ingredient);
        const id = Number(normalized.id ?? -1);
        if (!Number.isFinite(id) || id < 0) {
          return undefined;
        }
        return [Math.trunc(id), normalized] as const;
      })
      .filter((entry): entry is readonly [number, IngredientStorageRecord] => Boolean(entry)),
  );

  const createdCocktails: CocktailStorageRecord[] = [];
  const updatedCocktails: CocktailStorageRecord[] = [];
  const currentCocktailIds = new Set<number>();

  state.cocktails.forEach((cocktail) => {
    const normalized = toCocktailStorageRecord(cocktail);
    const id = Number(normalized.id ?? -1);
    if (!Number.isFinite(id) || id < 0) {
      return;
    }

    const normalizedId = Math.trunc(id);
    currentCocktailIds.add(normalizedId);

    const baseRecord = baseCocktails.get(normalizedId);
    if (!baseRecord) {
      createdCocktails.push(normalized);
      return;
    }

    if (!areStorageRecordsEqual(normalized, baseRecord)) {
      updatedCocktails.push(normalized);
    }
  });

  const deletedCocktailIds = Array.from(baseCocktails.keys()).filter((id) => !currentCocktailIds.has(id));

  const createdIngredients: IngredientStorageRecord[] = [];
  const updatedIngredients: IngredientStorageRecord[] = [];
  const currentIngredientIds = new Set<number>();

  state.ingredients.forEach((ingredient) => {
    const normalized = toIngredientStorageRecord(ingredient);
    const id = Number(normalized.id ?? -1);
    if (!Number.isFinite(id) || id < 0) {
      return;
    }

    const normalizedId = Math.trunc(id);
    currentIngredientIds.add(normalizedId);

    const baseRecord = baseIngredients.get(normalizedId);
    if (!baseRecord) {
      createdIngredients.push(normalized);
      return;
    }

    if (!areStorageRecordsEqual(normalized, baseRecord)) {
      updatedIngredients.push(normalized);
    }
  });

  const deletedIngredientIds = Array.from(baseIngredients.keys()).filter((id) => !currentIngredientIds.has(id));
  const sanitizedRatings = sanitizeCocktailRatings(options.cocktailRatings);

  return {
    version: INVENTORY_SNAPSHOT_VERSION,
    delta: {
      cocktails:
        createdCocktails.length > 0 || updatedCocktails.length > 0 || deletedCocktailIds.length > 0
          ? {
              created: createdCocktails.length > 0 ? createdCocktails : undefined,
              updated: updatedCocktails.length > 0 ? updatedCocktails : undefined,
              deletedIds: deletedCocktailIds.length > 0 ? deletedCocktailIds : undefined,
            }
          : undefined,
      ingredients:
        createdIngredients.length > 0 || updatedIngredients.length > 0 || deletedIngredientIds.length > 0
          ? {
              created: createdIngredients.length > 0 ? createdIngredients : undefined,
              updated: updatedIngredients.length > 0 ? updatedIngredients : undefined,
              deletedIds: deletedIngredientIds.length > 0 ? deletedIngredientIds : undefined,
            }
          : undefined,
    },
    imported: state.imported,
    hasSeenIngredientsOnboarding: options.hasSeenIngredientsOnboarding,
    customCocktailTags: options.customCocktailTags,
    customIngredientTags: options.customIngredientTags,
    availableIngredientIds:
      options.availableIngredientIds.size > 0
        ? toSortedArray(options.availableIngredientIds)
        : undefined,
    shoppingIngredientIds:
      options.shoppingIngredientIds.size > 0
        ? toSortedArray(options.shoppingIngredientIds)
        : undefined,
    cocktailRatings: Object.keys(sanitizedRatings).length > 0 ? sanitizedRatings : undefined,
    ignoreGarnish: options.ignoreGarnish,
    allowAllSubstitutes: options.allowAllSubstitutes,
    useImperialUnits: options.useImperialUnits,
    keepScreenAwake: options.keepScreenAwake,
    ratingFilterThreshold: options.ratingFilterThreshold,
    startScreen: options.startScreen,
  } satisfies InventoryDeltaSnapshot<CocktailStorageRecord, IngredientStorageRecord>;
}

const InventoryContext = createContext<InventoryContextValue | undefined>(undefined);

type InventoryProviderProps = {
  children: React.ReactNode;
};

export function InventoryProvider({ children }: InventoryProviderProps) {
  const [inventoryState, setInventoryState] = useState<InventoryState | undefined>(
    () => globalThis.__yourbarInventory,
  );
  const [loading, setLoading] = useState<boolean>(() => !globalThis.__yourbarInventory);
  const [availableIngredientIds, setAvailableIngredientIds] = useState<Set<number>>(() =>
    globalThis.__yourbarInventoryAvailableIngredientIds
      ? new Set(globalThis.__yourbarInventoryAvailableIngredientIds)
      : new Set(),
  );
  const [shoppingIngredientIds, setShoppingIngredientIds] = useState<Set<number>>(() =>
    globalThis.__yourbarInventoryShoppingIngredientIds
      ? new Set(globalThis.__yourbarInventoryShoppingIngredientIds)
      : new Set(),
  );
  const [cocktailRatings, setCocktailRatings] = useState<Record<string, number>>(() =>
    sanitizeCocktailRatings(globalThis.__yourbarInventoryCocktailRatings),
  );
  const [ignoreGarnish, setIgnoreGarnish] = useState<boolean>(
    () => globalThis.__yourbarInventoryIgnoreGarnish ?? true,
  );
  const [allowAllSubstitutes, setAllowAllSubstitutes] = useState<boolean>(
    () => globalThis.__yourbarInventoryAllowAllSubstitutes ?? true,
  );
  const [useImperialUnits, setUseImperialUnits] = useState<boolean>(
    () => globalThis.__yourbarInventoryUseImperialUnits ?? false,
  );
  const [keepScreenAwake, setKeepScreenAwake] = useState<boolean>(
    () => globalThis.__yourbarInventoryKeepScreenAwake ?? true,
  );
  const [ratingFilterThreshold, setRatingFilterThreshold] = useState<number>(() =>
    typeof globalThis.__yourbarInventoryRatingFilterThreshold === 'number'
      ? Math.min(5, Math.max(1, Math.round(globalThis.__yourbarInventoryRatingFilterThreshold)))
      : 1,
  );
  const [startScreen, setStartScreen] = useState<StartScreen>(
    () => globalThis.__yourbarInventoryStartScreen ?? DEFAULT_START_SCREEN,
  );
  const [hasSeenIngredientsOnboarding, setHasSeenIngredientsOnboarding] = useState<boolean>(
    () => globalThis.__yourbarInventoryHasSeenIngredientsOnboarding ?? true,
  );
  const [customCocktailTags, setCustomCocktailTags] = useState<CocktailTag[]>(() =>
    sanitizeCustomTags(globalThis.__yourbarInventoryCustomCocktailTags, DEFAULT_TAG_COLOR),
  );
  const [customIngredientTags, setCustomIngredientTags] = useState<IngredientTag[]>(() =>
    sanitizeCustomTags(globalThis.__yourbarInventoryCustomIngredientTags, DEFAULT_TAG_COLOR),
  );
  const lastPersistedSnapshot = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (inventoryState) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const stored = await loadInventorySnapshot<CocktailStorageRecord, IngredientStorageRecord>();
        if (stored && (stored.version === INVENTORY_SNAPSHOT_VERSION || stored.version === 1) && !cancelled) {
          const baseData = loadInventoryData();
          const nextInventoryState = createInventoryStateFromSnapshot(stored, baseData);
          const nextAvailableIds = createIngredientIdSet(stored.availableIngredientIds);
          const nextShoppingIds = createIngredientIdSet(stored.shoppingIngredientIds);
          const nextRatings = sanitizeCocktailRatings(stored.cocktailRatings);
          const nextIgnoreGarnish = stored.ignoreGarnish ?? true;
          const nextAllowAllSubstitutes = stored.allowAllSubstitutes ?? true;
          const nextUseImperialUnits = stored.useImperialUnits ?? false;
          const nextKeepScreenAwake = stored.keepScreenAwake ?? true;
          const nextRatingFilterThreshold = Math.min(
            5,
            Math.max(1, Math.round(stored.ratingFilterThreshold ?? 1)),
          );
          const nextStartScreen = sanitizeStartScreen(stored.startScreen);
          const nextHasSeenIngredientsOnboarding = stored.hasSeenIngredientsOnboarding ?? true;
          const nextCustomCocktailTags = sanitizeCustomTags(stored.customCocktailTags, DEFAULT_TAG_COLOR);
          const nextCustomIngredientTags = sanitizeCustomTags(stored.customIngredientTags, DEFAULT_TAG_COLOR);

          setInventoryState(nextInventoryState);
          setAvailableIngredientIds(nextAvailableIds);
          setShoppingIngredientIds(nextShoppingIds);
          setCocktailRatings(nextRatings);
          setIgnoreGarnish(nextIgnoreGarnish);
          setAllowAllSubstitutes(nextAllowAllSubstitutes);
          setUseImperialUnits(nextUseImperialUnits);
          setKeepScreenAwake(nextKeepScreenAwake);
          setRatingFilterThreshold(nextRatingFilterThreshold);
          setStartScreen(nextStartScreen);
          setHasSeenIngredientsOnboarding(nextHasSeenIngredientsOnboarding);
          setCustomCocktailTags(nextCustomCocktailTags);
          setCustomIngredientTags(nextCustomIngredientTags);
          return;
        }
      } catch (error) {
        console.error('Failed to load inventory snapshot', error);
      }

      try {
        const data = loadInventoryData();
        if (!cancelled) {
          setInventoryState(createInventoryStateFromData(data, true));
          setAvailableIngredientIds(new Set());
          setShoppingIngredientIds(new Set());
          setCocktailRatings({});
          setIgnoreGarnish(true);
          setAllowAllSubstitutes(true);
          setUseImperialUnits(false);
          setKeepScreenAwake(true);
          setStartScreen('ingredients_all');
          setHasSeenIngredientsOnboarding(false);
          setCustomCocktailTags([]);
          setCustomIngredientTags([]);
        }
      } catch (error) {
        console.error('Failed to import bundled inventory', error);
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [inventoryState]);

  useEffect(() => {
    if (!inventoryState) {
      return;
    }

    setLoading(false);
    globalThis.__yourbarInventory = inventoryState;
    globalThis.__yourbarInventoryAvailableIngredientIds = availableIngredientIds;
    globalThis.__yourbarInventoryShoppingIngredientIds = shoppingIngredientIds;
    globalThis.__yourbarInventoryCocktailRatings = cocktailRatings;
    globalThis.__yourbarInventoryIgnoreGarnish = ignoreGarnish;
    globalThis.__yourbarInventoryAllowAllSubstitutes = allowAllSubstitutes;
    globalThis.__yourbarInventoryUseImperialUnits = useImperialUnits;
    globalThis.__yourbarInventoryKeepScreenAwake = keepScreenAwake;
    globalThis.__yourbarInventoryRatingFilterThreshold = ratingFilterThreshold;
    globalThis.__yourbarInventoryStartScreen = startScreen;
    globalThis.__yourbarInventoryHasSeenIngredientsOnboarding = hasSeenIngredientsOnboarding;
    globalThis.__yourbarInventoryCustomCocktailTags = customCocktailTags;
    globalThis.__yourbarInventoryCustomIngredientTags = customIngredientTags;

    const snapshot = createDeltaSnapshotFromInventory(inventoryState, {
      availableIngredientIds,
      shoppingIngredientIds,
      cocktailRatings,
      ignoreGarnish,
      allowAllSubstitutes,
      useImperialUnits,
      keepScreenAwake,
      ratingFilterThreshold,
      startScreen,
      hasSeenIngredientsOnboarding,
      customCocktailTags,
      customIngredientTags,
    });
    const serialized = JSON.stringify(snapshot);

    if (lastPersistedSnapshot.current === serialized) {
      return;
    }

    lastPersistedSnapshot.current = serialized;

    void persistInventorySnapshot(snapshot).catch((error) => {
      console.error('Failed to persist inventory snapshot', error);
    });
  }, [
    inventoryState,
    availableIngredientIds,
    shoppingIngredientIds,
    cocktailRatings,
    ignoreGarnish,
    allowAllSubstitutes,
    useImperialUnits,
    keepScreenAwake,
    ratingFilterThreshold,
    startScreen,
    hasSeenIngredientsOnboarding,
    customCocktailTags,
    customIngredientTags,
  ]);

  const cocktails = inventoryState?.cocktails ?? [];
  const ingredients = inventoryState?.ingredients ?? [];

  const resolveCocktailKey = useCallback((cocktail: Cocktail) => {
    const id = cocktail.id;
    if (id != null) {
      return String(id);
    }

    if (cocktail.name) {
      return normalizeSearchText(cocktail.name);
    }

    return undefined;
  }, []);

  const setCocktailRating = useCallback(
    (cocktail: Cocktail, rating: number) => {
      const key = resolveCocktailKey(cocktail);
      if (!key) {
        return;
      }

      setCocktailRatings((prev) => {
        const normalizedRating = Math.max(0, Math.min(5, Math.round(rating)));

        if (normalizedRating <= 0) {
          if (!(key in prev)) {
            return prev;
          }

          const next = { ...prev };
          delete next[key];
          return next;
        }

        if (prev[key] === normalizedRating) {
          return prev;
        }

        return { ...prev, [key]: normalizedRating };
      });
    },
    [resolveCocktailKey],
  );

  const getCocktailRating = useCallback(
    (cocktail: Cocktail) => {
      const key = resolveCocktailKey(cocktail);
      if (!key) {
        return 0;
      }

      const rating = cocktailRatings[key];
      if (rating == null) {
        return 0;
      }

      return Math.max(0, Math.min(5, Number(rating) || 0));
    },
    [cocktailRatings, resolveCocktailKey],
  );

  const cocktailsWithRatings = useMemo(() => {
    return cocktails.map((cocktail) => {
      const key = resolveCocktailKey(cocktail);
      if (!key) {
        return cocktail;
      }

      const rating = cocktailRatings[key];
      if (rating == null) {
        return cocktail;
      }

      return {
        ...cocktail,
        userRating: rating,
      } satisfies Cocktail;
    });
  }, [cocktailRatings, cocktails, resolveCocktailKey]);

  const setIngredientAvailability = useCallback((id: number, available: boolean) => {
    setAvailableIngredientIds((prev) => {
      const next = new Set(prev);
      if (available) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const createCocktail = useCallback(
    (input: CreateCocktailInput) => {
      let created: Cocktail | undefined;

      setInventoryState((prev) => {
        if (!prev) {
          return prev;
        }

        const trimmedName = input.name?.trim();
        if (!trimmedName) {
          return prev;
        }

        const sanitizedIngredients = (input.ingredients ?? [])
          .map((ingredient, index) => {
            const trimmedIngredientName = ingredient.name?.trim();
            if (!trimmedIngredientName) {
              return undefined;
            }

            const normalizedIngredientId =
              ingredient.ingredientId != null ? Number(ingredient.ingredientId) : undefined;
            const ingredientId =
              normalizedIngredientId != null &&
              Number.isFinite(normalizedIngredientId) &&
              normalizedIngredientId >= 0
                ? Math.trunc(normalizedIngredientId)
                : undefined;

            const normalizedUnitId = ingredient.unitId != null ? Number(ingredient.unitId) : undefined;
            const unitId =
              normalizedUnitId != null && Number.isFinite(normalizedUnitId) && normalizedUnitId >= 0
                ? Math.trunc(normalizedUnitId)
                : undefined;

            const amount = ingredient.amount?.trim() || undefined;
            const optional = ingredient.optional ? true : undefined;
            const garnish = ingredient.garnish ? true : undefined;
            const allowBase = ingredient.allowBaseSubstitution ? true : undefined;
            const allowBrand = ingredient.allowBrandSubstitution ? true : undefined;

            const substituteInputs = ingredient.substitutes ?? [];
            const substitutes: CocktailSubstitute[] = [];
            const seenKeys = new Set<string>();

            substituteInputs.forEach((candidate) => {
              const substituteName = candidate?.name?.trim();
              if (!substituteName) {
                return;
              }

              const rawId = candidate.id != null ? Number(candidate.id) : undefined;
              const substituteId =
                rawId != null && Number.isFinite(rawId) && rawId >= 0 ? Math.trunc(rawId) : undefined;

              const rawIngredientLink =
                candidate.ingredientId != null ? Number(candidate.ingredientId) : undefined;
              const substituteIngredientId =
                rawIngredientLink != null && Number.isFinite(rawIngredientLink) && rawIngredientLink >= 0
                  ? Math.trunc(rawIngredientLink)
                  : substituteId;

              const key = substituteId != null ? `id:${substituteId}` : `name:${substituteName.toLowerCase()}`;
              if (seenKeys.has(key)) {
                return;
              }
              seenKeys.add(key);

              const brand = candidate.brand ? true : undefined;

              substitutes.push({
                id: substituteId ?? substituteIngredientId,
                ingredientId: substituteIngredientId,
                name: substituteName,
                brand,
              });
            });

            return {
              order: index + 1,
              ingredientId,
              name: trimmedIngredientName,
              amount,
              unitId,
              optional,
              garnish,
              allowBaseSubstitution: allowBase,
              allowBrandSubstitution: allowBrand,
              substitutes: substitutes.length > 0 ? substitutes : undefined,
            } satisfies CocktailIngredient;
          })
          .filter((value): value is CocktailIngredient => Boolean(value));

        if (sanitizedIngredients.length === 0) {
          return prev;
        }

        const nextId =
          prev.cocktails.reduce((maxId, cocktail) => {
            const id = Number(cocktail.id ?? -1);
            if (!Number.isFinite(id) || id < 0) {
              return maxId;
            }

            return Math.max(maxId, id);
          }, 0) + 1;

        const description = input.description?.trim() || undefined;
        const instructions = input.instructions?.trim() || undefined;
        const photoUri = input.photoUri?.trim() || undefined;
        const glassId = input.glassId?.trim() || undefined;
        const methodIds = input.methodIds
          ? Array.from(new Set(input.methodIds)).filter(Boolean)
          : undefined;

        const tagMap = new Map<number, CocktailTag>();
        (input.tags ?? []).forEach((tag) => {
          const id = Number(tag.id ?? -1);
          if (!Number.isFinite(id) || id < 0) {
            return;
          }

          if (!tagMap.has(id)) {
            tagMap.set(id, { id, name: tag.name, color: tag.color });
          }
        });
        const tags = tagMap.size > 0 ? Array.from(tagMap.values()) : undefined;

        const candidateRecord: CocktailRecord = {
          id: nextId,
          name: trimmedName,
          description,
          instructions,
          photoUri,
          glassId,
          methodIds: methodIds && methodIds.length > 0 ? methodIds : undefined,
          tags,
          ingredients: sanitizedIngredients.map((ingredient, index) => ({
            ...ingredient,
            order: index + 1,
          })),
        } satisfies CocktailRecord;

        const [normalized] = normalizeSearchFields([candidateRecord]);
        if (!normalized) {
          return prev;
        }

        created = normalized;

        const nextCocktails = [...prev.cocktails, normalized].sort((a, b) =>
          a.searchNameNormalized.localeCompare(b.searchNameNormalized),
        );

        return {
          ...prev,
          cocktails: nextCocktails,
        } satisfies InventoryState;
      });

      return created;
    },
    [],
  );

  const createIngredient = useCallback(
    (input: CreateIngredientInput) => {
      let created: Ingredient | undefined;

      setInventoryState((prev) => {
        if (!prev) {
          return prev;
        }

        const trimmedName = input.name?.trim();
        if (!trimmedName) {
          return prev;
        }

        const nextId =
          prev.ingredients.reduce((maxId, ingredient) => {
            const id = Number(ingredient.id ?? -1);
            if (!Number.isFinite(id) || id < 0) {
              return maxId;
            }

            return Math.max(maxId, id);
          }, 0) + 1;

        const normalizedBaseId =
          input.baseIngredientId != null ? Number(input.baseIngredientId) : undefined;
        const baseIngredientId =
          normalizedBaseId != null && Number.isFinite(normalizedBaseId) && normalizedBaseId >= 0
            ? Math.trunc(normalizedBaseId)
            : undefined;

        const description = input.description?.trim() || undefined;
        const photoUri = input.photoUri?.trim() || undefined;

        const tagMap = new Map<number, IngredientTag>();
        (input.tags ?? []).forEach((tag) => {
          const id = Number(tag.id ?? -1);
          if (!Number.isFinite(id) || id < 0) {
            return;
          }

          if (!tagMap.has(id)) {
            tagMap.set(id, {
              id,
              name: tag.name,
              color: tag.color,
            });
          }
        });
        const tags = tagMap.size > 0 ? Array.from(tagMap.values()) : undefined;

        const candidateRecord: IngredientRecord = {
          id: nextId,
          name: trimmedName,
          description,
          tags,
          baseIngredientId,
          usageCount: 0,
          photoUri,
        };

        const [normalized] = normalizeSearchFields([candidateRecord]);
        if (!normalized) {
          return prev;
        }

        const nextIngredients = [...prev.ingredients, normalized].sort((a, b) =>
          a.searchNameNormalized.localeCompare(b.searchNameNormalized),
        );

        created = normalized;

        return {
          ...prev,
          ingredients: nextIngredients,
        } satisfies InventoryState;
      });

      if (created?.id != null) {
        const id = Number(created.id);
        if (Number.isFinite(id) && id >= 0) {
          setAvailableIngredientIds((prev) => {
            if (prev.has(id)) {
              return prev;
            }

            const next = new Set(prev);
            next.add(id);
            return next;
          });

          setShoppingIngredientIds((prev) => {
            if (!prev.has(id)) {
              return prev;
            }

            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }
      }

      return created;
    },
    [],
  );

  const resetInventoryFromBundle = useCallback(async () => {
    try {
      await clearInventorySnapshot();
    } catch (error) {
      console.warn('Failed to clear inventory snapshot', error);
    }

    const data = reloadInventoryData();
    setInventoryState(createInventoryStateFromData(data, true));
    setAvailableIngredientIds(new Set());
    setShoppingIngredientIds(new Set());
    setCocktailRatings({});
    setIgnoreGarnish(true);
    setAllowAllSubstitutes(true);
    setUseImperialUnits(false);
    setKeepScreenAwake(true);
    setRatingFilterThreshold(1);
    setStartScreen(DEFAULT_START_SCREEN);
    setCustomCocktailTags([]);
    setCustomIngredientTags([]);
  }, []);

  const exportInventoryData = useCallback((): InventoryData | null => {
    if (!inventoryState) {
      return null;
    }

    const cocktails = inventoryState.cocktails.map((cocktail) => {
      const record = toCocktailStorageRecord(cocktail);
      return {
        ...record,
        photoUri: normalizePhotoUriForBackup({
          uri: record.photoUri,
          category: 'cocktails',
          id: record.id,
          name: record.name,
        }),
      };
    });
    const ingredients = inventoryState.ingredients.map((ingredient) => {
      const record = toIngredientStorageRecord(ingredient);
      return {
        ...record,
        photoUri: normalizePhotoUriForBackup({
          uri: record.photoUri,
          category: 'ingredients',
          id: record.id,
          name: record.name,
        }),
      };
    });

    return {
      cocktails,
      ingredients,
    };
  }, [inventoryState]);

  const exportInventoryPhotoEntries = useCallback((): PhotoBackupEntry[] | null => {
    if (!inventoryState) {
      return null;
    }

    return [
      ...inventoryState.cocktails.map((cocktail) => ({
        type: 'cocktails' as const,
        id: cocktail.id ?? '',
        name: cocktail.name ?? 'cocktail',
        uri: cocktail.photoUri ?? undefined,
      })),
      ...inventoryState.ingredients.map((ingredient) => ({
        type: 'ingredients' as const,
        id: ingredient.id ?? '',
        name: ingredient.name ?? 'ingredient',
        uri: ingredient.photoUri ?? undefined,
      })),
    ];
  }, [inventoryState]);

  const importInventoryData = useCallback((data: InventoryData) => {
    setInventoryState(createInventoryStateFromData(data, true));
    setAvailableIngredientIds(new Set());
    setShoppingIngredientIds(new Set());
    setCocktailRatings({});
  }, []);

  const updateIngredient = useCallback(
    (id: number, input: CreateIngredientInput) => {
      let updated: Ingredient | undefined;

      setInventoryState((prev) => {
        if (!prev) {
          return prev;
        }

        const normalizedId = Number(id);
        if (!Number.isFinite(normalizedId) || normalizedId < 0) {
          return prev;
        }

        const ingredientIndex = prev.ingredients.findIndex(
          (item) => Number(item.id ?? -1) === normalizedId,
        );

        if (ingredientIndex === -1) {
          return prev;
        }

        const trimmedName = input.name?.trim();
        if (!trimmedName) {
          return prev;
        }

        const normalizedBaseId =
          input.baseIngredientId != null ? Number(input.baseIngredientId) : undefined;
        const baseIngredientId =
          normalizedBaseId != null && Number.isFinite(normalizedBaseId) && normalizedBaseId >= 0
            ? Math.trunc(normalizedBaseId)
            : undefined;

        const description = input.description?.trim() || undefined;
        const photoUri = input.photoUri?.trim() || undefined;

        const tagMap = new Map<number, IngredientTag>();
        (input.tags ?? []).forEach((tag) => {
          const tagId = Number(tag.id ?? -1);
          if (!Number.isFinite(tagId) || tagId < 0) {
            return;
          }

          if (!tagMap.has(tagId)) {
            tagMap.set(tagId, {
              id: tagId,
              name: tag.name,
              color: tag.color,
            });
          }
        });
        const tags = tagMap.size > 0 ? Array.from(tagMap.values()) : undefined;

        const previous = prev.ingredients[ingredientIndex];
        const candidateRecord: IngredientRecord = {
          ...previous,
          id: previous.id,
          name: trimmedName,
          description,
          tags,
          baseIngredientId,
          usageCount: previous.usageCount,
          photoUri,
        };

        const [normalized] = normalizeSearchFields([candidateRecord]);
        if (!normalized) {
          return prev;
        }

        const nextIngredients = [...prev.ingredients];
        nextIngredients[ingredientIndex] = normalized;
        nextIngredients.sort((a, b) =>
          a.searchNameNormalized.localeCompare(b.searchNameNormalized),
        );

        updated = normalized;

        return {
          ...prev,
          ingredients: nextIngredients,
        } satisfies InventoryState;
      });

      return updated;
    },
    [],
  );

  const updateCocktail = useCallback((id: number, input: CreateCocktailInput) => {
    let updated: Cocktail | undefined;

    setInventoryState((prev) => {
      if (!prev) {
        return prev;
      }

      const trimmedName = input.name?.trim();
      if (!trimmedName) {
        return prev;
      }

      const targetId = Number(id);
      if (!Number.isFinite(targetId) || targetId < 0) {
        return prev;
      }

      const existingIndex = prev.cocktails.findIndex(
        (cocktail) => Number(cocktail.id ?? -1) === Math.trunc(targetId),
      );
      if (existingIndex < 0) {
        return prev;
      }

      const sanitizedIngredients = (input.ingredients ?? [])
        .map((ingredient, index) => {
          const trimmedIngredientName = ingredient.name?.trim();
          if (!trimmedIngredientName) {
            return undefined;
          }

          const normalizedIngredientId = ingredient.ingredientId != null ? Number(ingredient.ingredientId) : undefined;
          const ingredientId =
            normalizedIngredientId != null && Number.isFinite(normalizedIngredientId) && normalizedIngredientId >= 0
              ? Math.trunc(normalizedIngredientId)
              : undefined;

          const normalizedUnitId = ingredient.unitId != null ? Number(ingredient.unitId) : undefined;
          const unitId =
            normalizedUnitId != null && Number.isFinite(normalizedUnitId) && normalizedUnitId >= 0
              ? Math.trunc(normalizedUnitId)
              : undefined;

          const amount = ingredient.amount?.trim() || undefined;
          const optional = ingredient.optional ? true : undefined;
          const garnish = ingredient.garnish ? true : undefined;
          const allowBase = ingredient.allowBaseSubstitution ? true : undefined;
          const allowBrand = ingredient.allowBrandSubstitution ? true : undefined;

          const substituteInputs = ingredient.substitutes ?? [];
          const substitutes: CocktailSubstitute[] = [];
          const seenKeys = new Set<string>();

          substituteInputs.forEach((candidate) => {
            const substituteName = candidate?.name?.trim();
            if (!substituteName) {
              return;
            }

            const rawId = candidate.id != null ? Number(candidate.id) : undefined;
            const substituteId = rawId != null && Number.isFinite(rawId) && rawId >= 0 ? Math.trunc(rawId) : undefined;

            const rawIngredientLink = candidate.ingredientId != null ? Number(candidate.ingredientId) : undefined;
            const substituteIngredientId =
              rawIngredientLink != null && Number.isFinite(rawIngredientLink) && rawIngredientLink >= 0
                ? Math.trunc(rawIngredientLink)
                : substituteId;

            const key = substituteId != null ? `id:${substituteId}` : `name:${substituteName.toLowerCase()}`;
            if (seenKeys.has(key)) {
              return;
            }
            seenKeys.add(key);

            const brand = candidate.brand ? true : undefined;

            substitutes.push({
              id: substituteId ?? substituteIngredientId,
              ingredientId: substituteIngredientId,
              name: substituteName,
              brand,
            });
          });

          return {
            order: index + 1,
            ingredientId,
            name: trimmedIngredientName,
            amount,
            unitId,
            optional,
            garnish,
            allowBaseSubstitution: allowBase,
            allowBrandSubstitution: allowBrand,
            substitutes: substitutes.length > 0 ? substitutes : undefined,
          } satisfies CocktailIngredient;
        })
        .filter((value): value is CocktailIngredient => Boolean(value));

      if (sanitizedIngredients.length === 0) {
        return prev;
      }

      const description = input.description?.trim() || undefined;
      const instructions = input.instructions?.trim() || undefined;
      const photoUri = input.photoUri?.trim() || undefined;
      const glassId = input.glassId?.trim() || undefined;
      const methodIds = input.methodIds
        ? Array.from(new Set(input.methodIds)).filter(Boolean)
        : undefined;

      const tagMap = new Map<number, CocktailTag>();
      (input.tags ?? []).forEach((tag) => {
        const tagId = Number(tag.id ?? -1);
        if (!Number.isFinite(tagId) || tagId < 0) {
          return;
        }

        if (!tagMap.has(tagId)) {
          tagMap.set(tagId, { id: tagId, name: tag.name, color: tag.color });
        }
      });
      const tags = tagMap.size > 0 ? Array.from(tagMap.values()) : undefined;

      const existing = prev.cocktails[existingIndex];
      const candidateRecord: CocktailRecord = {
        id: existing.id,
        name: trimmedName,
        description,
        instructions,
        photoUri,
        glassId,
        methodIds: methodIds && methodIds.length > 0 ? methodIds : undefined,
        tags,
        ingredients: sanitizedIngredients.map((ingredient, index) => ({
          ...ingredient,
          order: index + 1,
        })),
      } satisfies CocktailRecord;

      const [normalized] = normalizeSearchFields([candidateRecord]);
      if (!normalized) {
        return prev;
      }

      updated = normalized;

      const nextCocktails = [...prev.cocktails];
      nextCocktails.splice(existingIndex, 1, normalized);

      const sortedCocktails = nextCocktails.sort((a, b) =>
        a.searchNameNormalized.localeCompare(b.searchNameNormalized),
      );

      return {
        ...prev,
        cocktails: sortedCocktails,
      } satisfies InventoryState;
    });

    return updated;
  }, []);

  const deleteIngredient = useCallback((id: number) => {
    const normalizedId = Number(id);
    if (!Number.isFinite(normalizedId) || normalizedId < 0) {
      return false;
    }

    let wasRemoved = false;

    setInventoryState((prev) => {
      if (!prev) {
        return prev;
      }

      let didUpdateDependents = false;

      const nextIngredients = prev.ingredients.reduce<Ingredient[]>((acc, ingredient) => {
        const ingredientId = Number(ingredient.id ?? -1);
        if (ingredientId === normalizedId) {
          wasRemoved = true;
          return acc;
        }

        if (
          ingredient.baseIngredientId != null &&
          Number(ingredient.baseIngredientId) === normalizedId
        ) {
          didUpdateDependents = true;
          acc.push({ ...ingredient, baseIngredientId: undefined } satisfies Ingredient);
          return acc;
        }

        acc.push(ingredient);
        return acc;
      }, []);

      if (!wasRemoved) {
        return prev;
      }

      if (didUpdateDependents) {
        nextIngredients.sort((a, b) =>
          a.searchNameNormalized.localeCompare(b.searchNameNormalized),
        );
      }

      return {
        ...prev,
        ingredients: nextIngredients,
      } satisfies InventoryState;
    });

    if (!wasRemoved) {
      return false;
    }

    setAvailableIngredientIds((prev) => {
      if (!prev.has(normalizedId)) {
        return prev;
      }

      const next = new Set(prev);
      next.delete(normalizedId);
      return next;
    });

    setShoppingIngredientIds((prev) => {
      if (!prev.has(normalizedId)) {
        return prev;
      }

      const next = new Set(prev);
      next.delete(normalizedId);
      return next;
    });

    return true;
  }, []);

  const deleteCocktail = useCallback(
    (id: number) => {
      const normalizedId = Number(id);
      if (!Number.isFinite(normalizedId) || normalizedId < 0) {
        return false;
      }

      let targetCocktail: Cocktail | undefined;

      setInventoryState((prev) => {
        if (!prev) {
          return prev;
        }

        let wasRemoved = false;

        const nextCocktails = prev.cocktails.filter((cocktail) => {
          const cocktailId = Number(cocktail.id ?? -1);
          if (cocktailId === normalizedId) {
            wasRemoved = true;
            targetCocktail = cocktail;
            return false;
          }

          return true;
        });

        if (!wasRemoved) {
          return prev;
        }

        return {
          ...prev,
          cocktails: nextCocktails,
        } satisfies InventoryState;
      });

      if (!targetCocktail) {
        return false;
      }

      setCocktailRatings((prev) => {
        const next = { ...prev };
        let didChange = false;

        const keyFromId = resolveCocktailKey(targetCocktail);
        if (keyFromId && keyFromId in next) {
          delete next[keyFromId];
          didChange = true;
        }

        const nameKey = targetCocktail.name ? normalizeSearchText(targetCocktail.name) : undefined;
        if (nameKey && nameKey in next) {
          delete next[nameKey];
          didChange = true;
        }

        return didChange ? next : prev;
      });

      return true;
    },
    [resolveCocktailKey],
  );

  const toggleIngredientAvailability = useCallback((id: number) => {
    setAvailableIngredientIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleIngredientShopping = useCallback((id: number) => {
    setShoppingIngredientIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSetIgnoreGarnish = useCallback((value: boolean) => {
    setIgnoreGarnish(Boolean(value));
  }, []);

  const handleSetAllowAllSubstitutes = useCallback((value: boolean) => {
    setAllowAllSubstitutes(Boolean(value));
  }, []);

  const handleSetUseImperialUnits = useCallback((value: boolean) => {
    setUseImperialUnits(Boolean(value));
  }, []);

  const handleSetKeepScreenAwake = useCallback((value: boolean) => {
    setKeepScreenAwake(Boolean(value));
  }, []);

  const handleSetRatingFilterThreshold = useCallback((value: number) => {
    const normalized = Math.min(5, Math.max(1, Math.round(value)));
    setRatingFilterThreshold(normalized);
  }, []);

  const handleSetStartScreen = useCallback((value: StartScreen) => {
    setStartScreen(sanitizeStartScreen(value));
  }, []);

  const createCustomCocktailTag = useCallback((input: { name: string; color?: string | null }) => {
    const trimmedName = input.name?.trim();
    if (!trimmedName) {
      return undefined;
    }

    const color = input.color?.trim() || DEFAULT_TAG_COLOR;
    let created: CocktailTag | undefined;

    setCustomCocktailTags((prev) => {
      const nextId = getNextCustomTagId(prev, BUILTIN_COCKTAIL_TAG_MAX);
      created = { id: nextId, name: trimmedName, color };
      return [...prev, created].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    });

    return created;
  }, []);

  const updateCustomCocktailTag = useCallback(
    (id: number, input: { name: string; color?: string | null }) => {
      const tagId = Number(id);
      if (!Number.isFinite(tagId) || tagId < 0) {
        return undefined;
      }

      const trimmedName = input.name?.trim();
      if (!trimmedName) {
        return undefined;
      }

      const color = input.color?.trim() || DEFAULT_TAG_COLOR;
      let updated: CocktailTag | undefined;

      setCustomCocktailTags((prev) => {
        const index = prev.findIndex((tag) => Number(tag.id ?? -1) === Math.trunc(tagId));
        if (index < 0) {
          return prev;
        }

        updated = { id: prev[index].id, name: trimmedName, color };
        const next = [...prev];
        next[index] = updated;
        next.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
        return next;
      });

      if (updated) {
        setInventoryState((prev) => {
          if (!prev) {
            return prev;
          }

          let didChange = false;
          const nextCocktails = prev.cocktails.map((cocktail) => {
            if (!cocktail.tags?.length) {
              return cocktail;
            }

            let didUpdateTag = false;
            const nextTags = cocktail.tags.map((tag) => {
              if (Number(tag.id ?? -1) === updated!.id) {
                didUpdateTag = true;
                return { ...tag, name: updated!.name, color: updated!.color };
              }
              return tag;
            });

            if (!didUpdateTag) {
              return cocktail;
            }

            didChange = true;
            return { ...cocktail, tags: nextTags } satisfies Cocktail;
          });

          return didChange
            ? ({
                ...prev,
                cocktails: nextCocktails,
              } satisfies InventoryState)
            : prev;
        });
      }

      return updated;
    },
    [],
  );

  const deleteCustomCocktailTag = useCallback((id: number) => {
    const tagId = Number(id);
    if (!Number.isFinite(tagId) || tagId < 0) {
      return false;
    }

    let didRemove = false;
    setCustomCocktailTags((prev) => {
      const next = prev.filter((tag) => Number(tag.id ?? -1) !== Math.trunc(tagId));
      didRemove = next.length !== prev.length;
      return didRemove ? next : prev;
    });

    if (didRemove) {
      setInventoryState((prev) => {
        if (!prev) {
          return prev;
        }

        let didChange = false;
        const nextCocktails = prev.cocktails.map((cocktail) => {
          if (!cocktail.tags?.length) {
            return cocktail;
          }

          const nextTags = cocktail.tags.filter((tag) => Number(tag.id ?? -1) !== Math.trunc(tagId));
          if (nextTags.length !== cocktail.tags.length) {
            didChange = true;
            return { ...cocktail, tags: nextTags.length ? nextTags : undefined } satisfies Cocktail;
          }
          return cocktail;
        });

        return didChange
          ? ({
              ...prev,
              cocktails: nextCocktails,
            } satisfies InventoryState)
          : prev;
      });
    }

    return didRemove;
  }, []);

  const createCustomIngredientTag = useCallback((input: { name: string; color?: string | null }) => {
    const trimmedName = input.name?.trim();
    if (!trimmedName) {
      return undefined;
    }

    const color = input.color?.trim() || DEFAULT_TAG_COLOR;
    let created: IngredientTag | undefined;

    setCustomIngredientTags((prev) => {
      const nextId = getNextCustomTagId(prev, BUILTIN_INGREDIENT_TAG_MAX);
      created = { id: nextId, name: trimmedName, color };
      return [...prev, created].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    });

    return created;
  }, []);

  const updateCustomIngredientTag = useCallback(
    (id: number, input: { name: string; color?: string | null }) => {
      const tagId = Number(id);
      if (!Number.isFinite(tagId) || tagId < 0) {
        return undefined;
      }

      const trimmedName = input.name?.trim();
      if (!trimmedName) {
        return undefined;
      }

      const color = input.color?.trim() || DEFAULT_TAG_COLOR;
      let updated: IngredientTag | undefined;

      setCustomIngredientTags((prev) => {
        const index = prev.findIndex((tag) => Number(tag.id ?? -1) === Math.trunc(tagId));
        if (index < 0) {
          return prev;
        }

        updated = { id: prev[index].id, name: trimmedName, color };
        const next = [...prev];
        next[index] = updated;
        next.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
        return next;
      });

      if (updated) {
        setInventoryState((prev) => {
          if (!prev) {
            return prev;
          }

          let didChange = false;
          const nextIngredients = prev.ingredients.map((ingredient) => {
            if (!ingredient.tags?.length) {
              return ingredient;
            }

            let didUpdateTag = false;
            const nextTags = ingredient.tags.map((tag) => {
              if (Number(tag.id ?? -1) === updated!.id) {
                didUpdateTag = true;
                return { ...tag, name: updated!.name, color: updated!.color };
              }
              return tag;
            });

            if (!didUpdateTag) {
              return ingredient;
            }

            didChange = true;
            return { ...ingredient, tags: nextTags } satisfies Ingredient;
          });

          return didChange
            ? ({
                ...prev,
                ingredients: nextIngredients,
              } satisfies InventoryState)
            : prev;
        });
      }

      return updated;
    },
    [],
  );

  const deleteCustomIngredientTag = useCallback((id: number) => {
    const tagId = Number(id);
    if (!Number.isFinite(tagId) || tagId < 0) {
      return false;
    }

    let didRemove = false;
    setCustomIngredientTags((prev) => {
      const next = prev.filter((tag) => Number(tag.id ?? -1) !== Math.trunc(tagId));
      didRemove = next.length !== prev.length;
      return didRemove ? next : prev;
    });

    if (didRemove) {
      setInventoryState((prev) => {
        if (!prev) {
          return prev;
        }

        let didChange = false;
        const nextIngredients = prev.ingredients.map((ingredient) => {
          if (!ingredient.tags?.length) {
            return ingredient;
          }

          const nextTags = ingredient.tags.filter((tag) => Number(tag.id ?? -1) !== Math.trunc(tagId));
          if (nextTags.length !== ingredient.tags.length) {
            didChange = true;
            return { ...ingredient, tags: nextTags.length ? nextTags : undefined } satisfies Ingredient;
          }
          return ingredient;
        });

        return didChange
          ? ({
              ...prev,
              ingredients: nextIngredients,
            } satisfies InventoryState)
          : prev;
      });
    }

    return didRemove;
  }, []);

  const clearBaseIngredient = useCallback((id: number) => {
    setInventoryState((prev) => {
      if (!prev) {
        return prev;
      }

      let didChange = false;
      const nextIngredients = prev.ingredients.map((ingredient) => {
        if (Number(ingredient.id ?? -1) === id && ingredient.baseIngredientId != null) {
          didChange = true;
          return { ...ingredient, baseIngredientId: undefined } satisfies Ingredient;
        }
        return ingredient;
      });

      if (!didChange) {
        return prev;
      }

      return {
        ...prev,
        ingredients: nextIngredients,
      } satisfies InventoryState;
    });
  }, []);

  const value = useMemo<InventoryContextValue>(() => {
    return {
      cocktails: cocktailsWithRatings,
      ingredients,
      loading,
      availableIngredientIds,
      shoppingIngredientIds,
      customCocktailTags,
      customIngredientTags,
      ignoreGarnish,
      allowAllSubstitutes,
      useImperialUnits,
      keepScreenAwake,
      ratingFilterThreshold,
      startScreen,
      hasSeenIngredientsOnboarding,
      setIngredientAvailability,
      toggleIngredientAvailability,
      toggleIngredientShopping,
      clearBaseIngredient,
      createCocktail,
      createIngredient,
      resetInventoryFromBundle,
      exportInventoryData,
      exportInventoryPhotoEntries,
      importInventoryData,
      updateCocktail,
      updateIngredient,
      deleteCocktail,
      deleteIngredient,
      createCustomCocktailTag,
      updateCustomCocktailTag,
      deleteCustomCocktailTag,
      createCustomIngredientTag,
      updateCustomIngredientTag,
      deleteCustomIngredientTag,
      cocktailRatings,
      setCocktailRating,
      getCocktailRating,
      setIgnoreGarnish: handleSetIgnoreGarnish,
      setAllowAllSubstitutes: handleSetAllowAllSubstitutes,
      setUseImperialUnits: handleSetUseImperialUnits,
      setKeepScreenAwake: handleSetKeepScreenAwake,
      setRatingFilterThreshold: handleSetRatingFilterThreshold,
      setStartScreen: handleSetStartScreen,
      setHasSeenIngredientsOnboarding,
    };
  }, [
    cocktailsWithRatings,
    ingredients,
    loading,
    availableIngredientIds,
    shoppingIngredientIds,
    customCocktailTags,
    customIngredientTags,
    ignoreGarnish,
    allowAllSubstitutes,
    useImperialUnits,
    keepScreenAwake,
    ratingFilterThreshold,
    startScreen,
    hasSeenIngredientsOnboarding,
    setIngredientAvailability,
    toggleIngredientAvailability,
    toggleIngredientShopping,
    clearBaseIngredient,
    createCocktail,
    createIngredient,
    resetInventoryFromBundle,
    exportInventoryData,
    exportInventoryPhotoEntries,
    importInventoryData,
    updateCocktail,
    updateIngredient,
    deleteCocktail,
    deleteIngredient,
    createCustomCocktailTag,
    updateCustomCocktailTag,
    deleteCustomCocktailTag,
    createCustomIngredientTag,
    updateCustomIngredientTag,
    deleteCustomIngredientTag,
    cocktailRatings,
    setCocktailRating,
    getCocktailRating,
    handleSetIgnoreGarnish,
    handleSetAllowAllSubstitutes,
    handleSetUseImperialUnits,
    handleSetKeepScreenAwake,
    handleSetRatingFilterThreshold,
    handleSetStartScreen,
    setHasSeenIngredientsOnboarding,
  ]);

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventory() {
  const context = useContext(InventoryContext);

  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }

  return context;
}

export type { Cocktail, Ingredient, CreateIngredientInput, CreateCocktailInput, StartScreen };
