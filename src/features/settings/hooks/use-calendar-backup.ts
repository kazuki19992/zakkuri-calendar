import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { writeCalendarBackup } from '@/data/sqlite/calendar-backup';

export function useCalendarBackup() {
  const database = useSQLiteContext();
  const busy = useRef(false);
  const [isExporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return undefined;

  const exportBackup = () => {
    if (busy.current) return;
    Alert.alert(
      'バックアップを書き出す',
      'ファイルには予定、メモ、設定が含まれます。共有画面で保存先を選んでください。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '書き出す',
          onPress: () => {
            if (busy.current) return;
            busy.current = true;
            setError(null);
            setExporting(true);
            void writeCalendarBackup(database)
              .catch(() => setError('バックアップを書き出せませんでした。もう一度お試しください。'))
              .finally(() => {
                busy.current = false;
                setExporting(false);
              });
          },
        },
      ],
    );
  };

  return { error, isExporting, exportBackup };
}
