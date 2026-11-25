import { backupDatabaseAsync, openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { writeCalendarBackup } from '../calendar-backup';

const mockDelete = jest.fn();
const mockCreate = jest.fn();
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'file:///test/cache/' },
  Directory: jest.fn(() => ({ uri: 'file:///test/cache/backup/', exists: true, create: mockCreate, delete: mockDelete })),
  File: jest.fn((directory, name) => ({ uri: directory.uri + name })),
}));
jest.mock('expo-sqlite', () => ({ backupDatabaseAsync: jest.fn(), openDatabaseAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

const source = {} as SQLiteDatabase;
const closeAsync = jest.fn();
const destination = { closeAsync, execAsync: jest.fn() } as unknown as SQLiteDatabase;

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(isAvailableAsync).mockResolvedValue(true);
  jest.mocked(openDatabaseAsync).mockResolvedValue(destination);
});

it('稼働中のDBから整合した複製を作り、閉じてから共有し、一時ファイルを片付ける', async () => {
  await writeCalendarBackup(source);
  expect(backupDatabaseAsync).toHaveBeenCalledWith({ sourceDatabase: source, destDatabase: destination });
  expect(shareAsync).toHaveBeenCalledWith(expect.stringMatching(/\.sqlite$/), expect.any(Object));
  expect(closeAsync.mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(shareAsync).mock.invocationCallOrder[0]);
  expect(mockDelete).toHaveBeenCalledTimes(1);
});

it('ファイル名に端末のローカル日付を使う', async () => {
  jest.useFakeTimers({ now: new Date(2026, 8, 8, 0, 30) });
  try {
    await writeCalendarBackup(source);

    expect(openDatabaseAsync).toHaveBeenCalledWith('zakkuri-calendar-2026-09-08.sqlite', {}, expect.any(String));
    expect(shareAsync).toHaveBeenCalledWith(expect.stringMatching(/zakkuri-calendar-2026-09-08\.sqlite$/), expect.any(Object));
  } finally {
    jest.useRealTimers();
  }
});

it('複製に失敗したら共有せず、一時ファイルを片付ける', async () => {
  jest.mocked(backupDatabaseAsync).mockRejectedValueOnce(new Error('copy failed'));
  await expect(writeCalendarBackup(source)).rejects.toThrow('copy failed');
  expect(shareAsync).not.toHaveBeenCalled();
  expect(closeAsync).toHaveBeenCalledTimes(1);
  expect(mockDelete).toHaveBeenCalledTimes(1);
});
