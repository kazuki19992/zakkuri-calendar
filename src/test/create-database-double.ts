import type { AppDatabase } from '@/data/sqlite/database';

export type DatabaseDouble = Readonly<{
  database: AppDatabase;
  exec: jest.Mock;
  run: jest.Mock;
  first: jest.Mock;
  all: jest.Mock;
  exclusiveTransaction: jest.Mock;
}>;

export function createDatabaseDouble(): DatabaseDouble {
  const exec = jest.fn().mockResolvedValue(undefined);
  const run = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
  const first = jest.fn().mockResolvedValue(null);
  const all = jest.fn().mockResolvedValue([]);
  const database = {} as AppDatabase;
  const exclusiveTransaction = jest.fn(async (task: (transaction: AppDatabase) => Promise<void>) => {
    await task(database);
  });
  Object.assign(database, { exec, run, first, all, exclusiveTransaction });
  return { database, exec, run, first, all, exclusiveTransaction };
}
