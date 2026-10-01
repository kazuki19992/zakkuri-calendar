import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

export function DeleteEventButton({ title, disabled, isRecurring = false, usesScopeSelection = false, onDelete }: Readonly<{ title: string; disabled: boolean; isRecurring?: boolean; usesScopeSelection?: boolean; onDelete(): void }>) {
  const theme = useTheme();
  const label = isRecurring ? '繰り返し予定を削除' : '予定を削除';
  const message = isRecurring
    ? `「${title || 'この予定'}」の繰り返しシリーズ全体を削除しますか？`
    : `「${title || 'この予定'}」を削除しますか？`;
  const handlePress = usesScopeSelection ? onDelete : () => Alert.alert(label, message, [
    { text: 'キャンセル', style: 'cancel' }, { text: '削除', style: 'destructive', onPress: onDelete },
  ]);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled}
    onPress={handlePress} style={styles.button}><Text style={{ color: theme.calendarHoliday }}>{label}</Text></Pressable>;
}
const styles = StyleSheet.create({ button: { alignItems: 'center', justifyContent: 'center', minHeight: 44, marginTop: 24 } });
