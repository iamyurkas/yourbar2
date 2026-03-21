declare module 'expo-sqlite' {
  export type SQLiteBindParams = (string | number | null)[];

  export type SQLiteDatabase = {
    execAsync: (source: string) => Promise<void>;
    runAsync: (source: string, params?: SQLiteBindParams) => Promise<void>;
    getFirstAsync: <T>(source: string, params?: SQLiteBindParams) => Promise<T | null>;
    getAllAsync: <T>(source: string, params?: SQLiteBindParams) => Promise<T[]>;
    withTransactionAsync: <T>(task: () => Promise<T>) => Promise<T>;
  };

  export function openDatabaseAsync(name: string): Promise<SQLiteDatabase>;
}
