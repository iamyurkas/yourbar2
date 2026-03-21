declare module 'expo-sqlite' {
  export type SQLiteDatabase = {
    execAsync(sql: string): Promise<void>;
    runAsync(sql: string, ...params: unknown[]): Promise<void>;
    getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null>;
    getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]>;
    closeAsync?(): Promise<void>;
  };

  export function openDatabaseAsync(name: string): Promise<SQLiteDatabase>;
}
