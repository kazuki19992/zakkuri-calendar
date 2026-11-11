import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { createExpoDatabaseAdapter } from '../database';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

describe('Expoデータベースadapter', () => {
  it('クエリを委譲し書込み結果を返す', async () => {
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

  it.each([0, 1])('専用接続へ外部キー設定%iをBEGIN前に引き継ぎcallbackへ渡す', async (foreignKeys) => {
    const transaction = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      withTransactionAsync: jest.fn(async (task: () => Promise<void>) => task()),
      closeAsync: jest.fn().mockResolvedValue(undefined),
    } as unknown as SQLiteDatabase;
    jest.mocked(openDatabaseAsync).mockResolvedValue(transaction);
    const db = {
      databasePath: '/synthetic/custom/calendar.db', options: { enableChangeListener: true },
      getFirstAsync: jest.fn().mockResolvedValue({ foreign_keys: foreignKeys }),
    } as unknown as SQLiteDatabase;
    await createExpoDatabaseAdapter(db).exclusiveTransaction((tx) => tx.exec('SELECT 1'));
    expect(openDatabaseAsync).toHaveBeenCalledWith('calendar.db', {
      enableChangeListener: true, useNewConnection: true,
    }, '/synthetic/custom');
    expect(transaction.execAsync).toHaveBeenNthCalledWith(1, `PRAGMA foreign_keys = ${foreignKeys ? 'ON' : 'OFF'};`);
    expect(jest.mocked(transaction.execAsync).mock.invocationCallOrder[0])
      .toBeLessThan(jest.mocked(transaction.withTransactionAsync).mock.invocationCallOrder[0]);
    expect(transaction.execAsync).toHaveBeenLastCalledWith('SELECT 1');
    expect(transaction.closeAsync).toHaveBeenCalledTimes(1);
  });

  it('callback失敗時も専用接続を閉じ元のエラーを返す', async () => {
    const transaction = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      withTransactionAsync: jest.fn(async (task: () => Promise<void>) => task()),
      closeAsync: jest.fn().mockResolvedValue(undefined),
    } as unknown as SQLiteDatabase;
    jest.mocked(openDatabaseAsync).mockResolvedValue(transaction);
    const db = { databasePath: '/synthetic/calendar.db', options: {},
      getFirstAsync: jest.fn().mockResolvedValue({ foreign_keys: 1 }),
    } as unknown as SQLiteDatabase;
    const error = new Error('synthetic failure');
    await expect(createExpoDatabaseAdapter(db).exclusiveTransaction(async () => { throw error; }))
      .rejects.toBe(error);
    expect(transaction.closeAsync).toHaveBeenCalledTimes(1);
  });
});
