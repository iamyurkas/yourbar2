import * as FileSystem from 'expo-file-system';

export type PersistedInventoryState = {
  availableIngredientIds: number[];
  shoppingIngredientIds: number[];
  cocktailRatings: Record<string, number>;
};

const STORAGE_FILE_NAME = 'inventory-state.json';
const LOCAL_STORAGE_KEY = 'yourbar:inventory-state';

type OptionalStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
};

type StorageDriver = {
  read(): Promise<string | null>;
  write(data: string): Promise<void>;
};

const globalWithStorage = globalThis as typeof globalThis & {
  localStorage?: OptionalStorage;
  window?: { localStorage?: OptionalStorage };
};

let didWarnMissingStorage = false;
let cachedStorageDriver: StorageDriver | null = null;

function warnMissingStorage() {
  if (!didWarnMissingStorage) {
    console.warn('Inventory persistence is disabled: no storage backend available.');
    didWarnMissingStorage = true;
  }
}

function getFileSystemBaseDirectory(): string | null {
  const { documentDirectory, cacheDirectory } = FileSystem;

  if (typeof documentDirectory === 'string' && documentDirectory.length > 0) {
    return documentDirectory.endsWith('/') ? documentDirectory : `${documentDirectory}/`;
  }

  if (typeof cacheDirectory === 'string' && cacheDirectory.length > 0) {
    return cacheDirectory.endsWith('/') ? cacheDirectory : `${cacheDirectory}/`;
  }

  return null;
}

function getLocalStorage(): OptionalStorage | null {
  try {
    if (globalWithStorage.localStorage) {
      return globalWithStorage.localStorage;
    }

    if (globalWithStorage.window?.localStorage) {
      return globalWithStorage.window.localStorage;
    }
  } catch (error) {
    console.warn('Failed to access localStorage for inventory persistence', error);
  }

  return null;
}

function createFileSystemDriver(baseDirectory: string): StorageDriver {
  const path = `${baseDirectory}${STORAGE_FILE_NAME}`;

  return {
    async read() {
      try {
        const info = await FileSystem.getInfoAsync(path);
        if (!info.exists || info.isDirectory) {
          return null;
        }
        return await FileSystem.readAsStringAsync(path, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      } catch (error) {
        console.warn('Failed to read inventory storage file', error);
        return null;
      }
    },
    async write(data: string) {
      try {
        await FileSystem.writeAsStringAsync(path, data, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      } catch (error) {
        console.warn('Failed to write inventory storage file', error);
      }
    },
  } satisfies StorageDriver;
}

function createLocalStorageDriver(storage: OptionalStorage): StorageDriver {
  return {
    async read() {
      try {
        return storage.getItem(LOCAL_STORAGE_KEY);
      } catch (error) {
        console.warn('Failed to read inventory storage from localStorage', error);
        return null;
      }
    },
    async write(data: string) {
      try {
        storage.setItem(LOCAL_STORAGE_KEY, data);
      } catch (error) {
        console.warn('Failed to write inventory storage to localStorage', error);
      }
    },
  } satisfies StorageDriver;
}

function resolveStorageDriver(): StorageDriver {
  if (cachedStorageDriver) {
    return cachedStorageDriver;
  }

  const baseDirectory = getFileSystemBaseDirectory();
  if (baseDirectory) {
    cachedStorageDriver = createFileSystemDriver(baseDirectory);
    return cachedStorageDriver;
  }

  const localStorageInstance = getLocalStorage();
  if (localStorageInstance) {
    cachedStorageDriver = createLocalStorageDriver(localStorageInstance);
    return cachedStorageDriver;
  }

  warnMissingStorage();

  return {
    async read() {
      return null;
    },
    async write() {
      // no-op
    },
  } satisfies StorageDriver;
}

const EMPTY_STATE: PersistedInventoryState = {
  availableIngredientIds: [],
  shoppingIngredientIds: [],
  cocktailRatings: {},
};

function toSortedUniqueIds(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = new Set<number>();
  value.forEach((item) => {
    const numeric = Number(item);
    if (Number.isFinite(numeric) && numeric >= 0) {
      unique.add(Math.trunc(numeric));
    }
  });

  return Array.from(unique).sort((a, b) => a - b);
}

function sanitizeRatings(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const sanitized: Record<string, number> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, ratingValue]) => {
    if (!key) {
      return;
    }

    const numeric = Number(ratingValue);
    if (!Number.isFinite(numeric)) {
      return;
    }

    const clamped = Math.max(0, Math.min(5, Math.round(numeric)));
    if (clamped > 0) {
      sanitized[key] = clamped;
    }
  });

  return sanitized;
}

function sanitizeState(value: unknown): PersistedInventoryState {
  if (!value || typeof value !== 'object') {
    return { ...EMPTY_STATE };
  }

  const maybeState = value as Partial<PersistedInventoryState>;

  return {
    availableIngredientIds: toSortedUniqueIds(maybeState.availableIngredientIds),
    shoppingIngredientIds: toSortedUniqueIds(maybeState.shoppingIngredientIds),
    cocktailRatings: sanitizeRatings(maybeState.cocktailRatings),
  } satisfies PersistedInventoryState;
}

export async function loadPersistedInventoryState(): Promise<PersistedInventoryState> {
  try {
    const driver = resolveStorageDriver();
    const raw = await driver.read();
    if (!raw) {
      return { ...EMPTY_STATE };
    }

    const parsed = JSON.parse(raw);
    return sanitizeState(parsed);
  } catch (error) {
    console.warn('Failed to load inventory persistence state', error);
    return { ...EMPTY_STATE };
  }
}

export async function savePersistedInventoryState(state: PersistedInventoryState): Promise<void> {
  try {
    const sanitized = sanitizeState(state);
    const serialized = JSON.stringify(sanitized);
    const driver = resolveStorageDriver();
    await driver.write(serialized);
  } catch (error) {
    console.warn('Failed to persist inventory state', error);
  }
}
