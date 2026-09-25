import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import type { CalendarTopBarModel } from '../calendar-top-bar-model';

export const CALENDAR_TOP_BAR_HEIGHT = 52;

export function CalendarTopBar({
  model,
  isLoading,
  onOpenMenu,
  onToggleDatePicker,
  onToday,
}: Readonly<{
  model: CalendarTopBarModel;
  isLoading: boolean;
  onOpenMenu(): void;
  onToggleDatePicker(): void;
  onToday(): void;
}>) {
  const theme = useTheme();
  return (
    <View testID="calendar.top-bar" style={[styles.container, { backgroundColor: theme.calendarOverlay }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="表示メニューを開く"
        onPress={onOpenMenu} style={styles.iconButton}>
        <Text style={[styles.menuIcon, { color: theme.text }]}>☰</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={model.accessibilityLabel}
        onPress={onToggleDatePicker} style={styles.monthButton}>
        {model.yearLabel === null ? null : (
          <Text style={[styles.year, { color: theme.textSecondary }]}>{model.yearLabel}</Text>
        )}
        <View style={styles.monthLine}>
          <Text style={[styles.month, { color: theme.text }]}>{model.monthLabel}</Text>
          <Text style={[styles.chevron, { color: theme.textSecondary }]}>▼</Text>
        </View>
      </Pressable>
      <View style={styles.spacer} />
      <Pressable accessibilityRole="button" accessibilityLabel="今日へ移動"
        accessibilityState={{ disabled: isLoading }} disabled={isLoading}
        onPress={onToday} style={styles.iconButton}>
        <Text style={[styles.todayIcon, { color: isLoading ? theme.textSecondary : theme.calendarAccent }]}>◎</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: CALENDAR_TOP_BAR_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  menuIcon: { fontSize: 20 },
  monthButton: { minHeight: 44, minWidth: 72, justifyContent: 'center', paddingHorizontal: 4 },
  year: { fontSize: 10, lineHeight: 11 },
  monthLine: { flexDirection: 'row', alignItems: 'center' },
  month: { fontSize: 21, fontWeight: '500', lineHeight: 25 },
  chevron: { fontSize: 8, marginLeft: 5 },
  spacer: { flex: 1 },
  todayIcon: { fontSize: 22, fontWeight: '600' },
});
