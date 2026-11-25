import { format } from 'date-fns';
import { Directory, File, Paths } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { backupDatabaseAsync, openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

export async function writeCalendarBackup(sourceDatabase: SQLiteDatabase): Promise<void> {
  if (!(await isAvailableAsync())) throw new Error('Backup sharing is unavailable');

  const now = new Date();
  const folder = new Directory(Paths.cache, `zakkuri-backup-${now.getTime()}-${Math.random().toString(36).slice(2)}`);
  const filename = `zakkuri-calendar-${format(now, 'yyyy-MM-dd')}.sqlite`;
  folder.create();
  try {
    const destDatabase = await openDatabaseAsync(filename, {}, folder.uri);
    try {
      // 稼働中のDBをファイルコピーせず、WALも含め一貫した内容をSQLite自身で複製する。
      await backupDatabaseAsync({ sourceDatabase, destDatabase });
      await destDatabase.execAsync('PRAGMA journal_mode = DELETE');
    } finally {
      await destDatabase.closeAsync();
    }

    await shareAsync(new File(folder, filename).uri, {
      dialogTitle: 'カレンダーのバックアップを書き出す',
      mimeType: 'application/vnd.sqlite3',
      UTI: 'public.database',
    });
  } finally {
    if (folder.exists) folder.delete();
  }
}
