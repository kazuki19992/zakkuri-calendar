import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import type { SQLiteDatabase, SQLiteOpenOptions } from 'expo-sqlite';
import { createExpoDatabaseAdapter } from '@/data/sqlite/database';

/** テスト専用。SQLは実SQLite、接続とtransactionの形はExpo 57へ合わせる。 */
export function openNodeSqliteConnection(path: string, options: SQLiteOpenOptions = {}): SQLiteDatabase {
  // SQLite/Expoと同じく接続ごとのFK初期値はOFF。migrationのONと区別する。
  const sqlite = new DatabaseSync(path, { enableForeignKeyConstraints: false });
  const prepare = (source: string) => {
    const statement = sqlite.prepare(source);
    // expo-sqlite 57のiOS/AndroidはSQLにない名前付き引数（index=0）を無視する。
    statement.setAllowUnknownNamedParameters(true);
    return statement;
  };
  const connection = {
    databasePath: path,
    options,
    async execAsync(source: string) { sqlite.exec(source); },
    async runAsync(source: string, params?: Record<string, string | number | null>) {
      const statement = prepare(source);
      const result = params ? statement.run(params) : statement.run();
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
    async getFirstAsync<T>(source: string, params?: Record<string, string | number | null>) {
      const statement = prepare(source);
      return ((params ? statement.get(params) : statement.get()) ?? null) as T | null;
    },
    async getAllAsync<T>(source: string, params?: Record<string, string | number | null>) {
      const statement = prepare(source);
      return (params ? statement.all(params) : statement.all()) as T[];
    },
    async withTransactionAsync(task: () => Promise<void>) {
      sqlite.exec('BEGIN');
      try {
        await task();
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
    async withExclusiveTransactionAsync(task: (transaction: SQLiteDatabase) => Promise<void>) {
      // SDK標準APIも新規接続を開く。元接続のPRAGMAは引き継がない。
      const transaction = openNodeSqliteConnection(path, { ...options, useNewConnection: true });
      try {
        await transaction.execAsync('BEGIN');
        try {
          await task(transaction);
          await transaction.execAsync('COMMIT');
        } catch (error) {
          await transaction.execAsync('ROLLBACK');
          throw error;
        }
      } finally {
        await transaction.closeAsync();
      }
    },
    async closeAsync() { sqlite.close(); },
  };
  return connection as unknown as SQLiteDatabase;
}

export async function openNodeSqliteDatabase(path: string) {
  const connection = openNodeSqliteConnection(path);
  return { database: createExpoDatabaseAdapter(connection), close: () => connection.closeAsync() };
}

/** ExpoのopenDatabaseAsyncと同じ引数で、一時DBの新しい接続を開く。 */
export async function openNodeSqliteDatabaseAsync(name: string, options?: SQLiteOpenOptions, directory?: string) {
  return openNodeSqliteConnection(join(directory ?? '', name), options);
}
