import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

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
    async exclusiveTransaction(task) {
      const constraints = await database.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys');
      if (constraints?.foreign_keys !== 0 && constraints?.foreign_keys !== 1) {
        throw new Error('Unable to read database constraints');
      }
      const separator = database.databasePath.lastIndexOf('/');
      const transaction = await openDatabaseAsync(
        database.databasePath.slice(separator + 1),
        { ...database.options, useNewConnection: true },
        separator < 0 ? undefined : database.databasePath.slice(0, separator),
      );
      try {
        // Expo標準の排他transactionは別接続のFK設定を引き継がない。
        // BEGIN後のPRAGMA変更は無効なので、専用接続へ先に適用する。
        // migrationで親tableを再構築する間だけは元接続と同じOFFを維持する。
        await transaction.execAsync(`PRAGMA foreign_keys = ${constraints.foreign_keys === 1 ? 'ON' : 'OFF'};`);
        await transaction.withTransactionAsync(() => task(createExpoDatabaseAdapter(transaction)));
      } finally {
        await transaction.closeAsync();
      }
    },
  };
}
