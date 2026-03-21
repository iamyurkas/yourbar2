declare module 'expo-sqlite' {
  export type SQLiteDatabase = {
    execAsync(sql: string): Promise<void>;
    getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
    getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
  };

  export function openDatabaseAsync(name: string): Promise<SQLiteDatabase>;
}
