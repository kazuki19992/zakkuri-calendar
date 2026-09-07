import type { SQLiteDatabase } from 'expo-sqlite';

export type AppRunResult = Readonly<{ changes: number; lastInsertRowId: number }>;
export type AppDatabaseParameter = string | number | null;
export type AppDatabaseParameters = Record<string, AppDatabaseParameter>;

export interface AppDatabase {
  exec(source: string): Promise<void>;
  run(source: string, params?: AppDatabaseParameters): Promise<AppRunResult>;
  first<T>(source: string, params?: AppDatabaseParameters): Promise<T | null>;
  all<T>(source: string, params?: AppDatabaseParameters): Promise<T[]>;
  exclusiveTransaction(task: (transaction: AppDatabase) => Promise<void>): Promise<void>;
}

export function createExpoDatabaseAdapter(database: SQLiteDatabase): AppDatabase {
  return {
    exec: (source) => database.execAsync(source),
    async run(source, params) {
      const result = params ? await database.runAsync(source, params) : await database.runAsync(source);
      return { changes: result.changes, lastInsertRowId: result.lastInsertRowId };
    },
    first: <T>(source: string, params?: AppDatabaseParameters) =>
      params ? database.getFirstAsync<T>(source, params) : database.getFirstAsync<T>(source),
    all: <T>(source: string, params?: AppDatabaseParameters) =>
      params ? database.getAllAsync<T>(source, params) : database.getAllAsync<T>(source),
    exclusiveTransaction: (task) =>
      database.withExclusiveTransactionAsync((transaction) =>
        task(createExpoDatabaseAdapter(transaction)),
      ),
  };
}
