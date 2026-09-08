import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

export type MonthToolbarProps = Readonly<{
  visibleMonth: string;
  onPreviousMonth(): void;
  onToday(): void;
  onNextMonth(): void;
}>;

function formatMonth(visibleMonth: string): string {
  const [year, month] = visibleMonth.split('-');
  return `${year}年${Number(month)}月`;
}

export function MonthToolbar({
  visibleMonth,
  onPreviousMonth,
  onToday,
  onNextMonth,
}: MonthToolbarProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { borderBottomColor: theme.calendarBorder }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="前月"
        onPress={onPreviousMonth}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={[styles.buttonLabel, { color: theme.calendarAccent }]}>前月</Text>
      </Pressable>
      <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
        {formatMonth(visibleMonth)}
      </Text>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="今日"
          onPress={onToday}
          style={({ pressed }) => [styles.todayButton, pressed && styles.pressed]}
        >
          <Text style={[styles.buttonLabel, { color: theme.calendarAccent }]}>今日</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="次月"
          onPress={onNextMonth}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={[styles.buttonLabel, { color: theme.calendarAccent }]}>次月</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 4,
  },
  actions: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700', marginLeft: 4 },
  button: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  todayButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  buttonLabel: { fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.6 },
});
