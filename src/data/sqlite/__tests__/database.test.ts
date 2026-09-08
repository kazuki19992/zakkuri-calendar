import type { SQLiteDatabase } from 'expo-sqlite';
import { createExpoDatabaseAdapter } from '../database';

describe('createExpoDatabaseAdapter', () => {
  it('delegates queries and maps write metadata', async () => {
    const db = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue({ changes: 2, lastInsertRowId: 7 }),
      getFirstAsync: jest.fn().mockResolvedValue({ id: 'one' }),
      getAllAsync: jest.fn().mockResolvedValue([{ id: 'one' }]),
      withExclusiveTransactionAsync: jest.fn(),
    } as unknown as SQLiteDatabase;
    const adapter = createExpoDatabaseAdapter(db);
    const params = { $id: 'one' };

    await expect(adapter.exec('PRAGMA foreign_keys = ON')).resolves.toBeUndefined();
    await expect(adapter.run('UPDATE items SET id = $id', params)).resolves.toEqual({ changes: 2, lastInsertRowId: 7 });
    await expect(adapter.first('SELECT * FROM items WHERE id = $id', params)).resolves.toEqual({ id: 'one' });
    await expect(adapter.all('SELECT * FROM items WHERE id = $id', params)).resolves.toEqual([{ id: 'one' }]);
  });

  it('uses the transaction handle supplied by Expo', async () => {
    const transaction = { execAsync: jest.fn().mockResolvedValue(undefined) } as unknown as SQLiteDatabase;
    const db = {
      withExclusiveTransactionAsync: jest.fn(async (task: (value: SQLiteDatabase) => Promise<void>) => task(transaction)),
    } as unknown as SQLiteDatabase;
    const adapter = createExpoDatabaseAdapter(db);

    await adapter.exclusiveTransaction((tx) => tx.exec('CREATE TABLE example (id TEXT)'));

    expect(transaction.execAsync).toHaveBeenCalledWith('CREATE TABLE example (id TEXT)');
  });
});
