import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

export function DeleteEventButton({ title, disabled, isRecurring = false, onDelete }: Readonly<{ title: string; disabled: boolean; isRecurring?: boolean; onDelete(): void }>) {
  const theme = useTheme();
  const message = isRecurring
    ? `「${title || 'この予定'}」の繰り返しシリーズ全体を削除しますか？`
    : `「${title || 'この予定'}」を削除しますか？`;
  return <Pressable accessibilityRole="button" accessibilityLabel="予定を削除" disabled={disabled} onPress={() => Alert.alert('予定を削除', message, [
    { text: 'キャンセル', style: 'cancel' }, { text: '削除', style: 'destructive', onPress: onDelete },
  ])} style={styles.button}><Text style={{ color: theme.calendarHoliday }}>予定を削除</Text></Pressable>;
}
const styles = StyleSheet.create({ button: { alignItems: 'center', justifyContent: 'center', minHeight: 44, marginTop: 24 } });
