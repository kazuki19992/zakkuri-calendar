import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import type { EventDraft } from '@/domain/calendar/event';

export function EventTypePicker({ value, disabled, onChange }: Readonly<{
  value: EventDraft['temporalType']; disabled: boolean; onChange(value: EventDraft['temporalType']): void;
}>) {
  const theme = useTheme();
  return <View style={styles.row}>{([
    ['exact', '正確'], ['allDay', '終日'], ['fuzzy', 'ざっくり'],
  ] as const).map(([type, label]) => <Pressable key={type} accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ selected: value === type, disabled }} disabled={disabled} onPress={() => onChange(type)}
    style={[styles.button, { borderColor: theme.calendarBorder, backgroundColor: value === type ? theme.backgroundSelected : theme.background }]}>
    <Text style={{ color: theme.text }}>{label}</Text>
  </Pressable>)}</View>;
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: 8 }, button: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 44 } });
