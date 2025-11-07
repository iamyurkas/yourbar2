import * as FileSystem from 'expo-file-system';

const STORAGE_FILENAME = 'inventory-state.json';

export type InventorySnapshot<TCocktail, TIngredient> = {
  version: number;
  cocktails: TCocktail[];
  ingredients: TIngredient[];
  imported?: boolean;
};

function resolveStoragePath(): string | undefined {
  try {
    const directory = FileSystem.Paths.document;
    if (directory) {
      return FileSystem.Paths.join(directory, STORAGE_FILENAME);
    }
  } catch (error) {
    console.warn('Unable to access document directory for inventory snapshot', error);
  }

  try {
    const directory = FileSystem.Paths.cache;
    if (directory) {
      return FileSystem.Paths.join(directory, STORAGE_FILENAME);
    }
  } catch (error) {
    console.warn('Unable to access cache directory for inventory snapshot', error);
  }

  return undefined;
}

export async function loadInventorySnapshot<TCocktail, TIngredient>(): Promise<
  InventorySnapshot<TCocktail, TIngredient> | undefined
> {
  const storagePath = resolveStoragePath();

  if (!storagePath) {
    return undefined;
  }

  try {
    const info = await FileSystem.getInfoAsync(storagePath);
    if (!info.exists) {
      return undefined;
    }

    const contents = await FileSystem.readAsStringAsync(storagePath);

    if (!contents) {
      return undefined;
    }

    return JSON.parse(contents) as InventorySnapshot<TCocktail, TIngredient>;
  } catch (error) {
    console.warn('Unable to load inventory snapshot', error);
    return undefined;
  }
}

export async function persistInventorySnapshot<TCocktail, TIngredient>(
  snapshot: InventorySnapshot<TCocktail, TIngredient>,
): Promise<void> {
  const storagePath = resolveStoragePath();

  if (!storagePath) {
    return;
  }

  try {
    await FileSystem.writeAsStringAsync(storagePath, JSON.stringify(snapshot));
  } catch (error) {
    console.error('Unable to persist inventory snapshot', error);
    throw error;
  }
}

export async function clearInventorySnapshot(): Promise<void> {
  const storagePath = resolveStoragePath();

  if (!storagePath) {
    return;
  }

  try {
    const info = await FileSystem.getInfoAsync(storagePath);
    if (info.exists) {
      await FileSystem.deleteAsync(storagePath, { idempotent: true });
    }
  } catch (error) {
    console.warn('Unable to clear inventory snapshot', error);
  }
}
