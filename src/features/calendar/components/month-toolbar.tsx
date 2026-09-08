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

const WEEKDAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'] as const;

export function MonthToolbar({
  visibleMonth,
  onPreviousMonth,
  onToday,
  onNextMonth,
}: MonthToolbarProps) {
  const theme = useTheme();

  return (
    <View>
      <View style={styles.container}>
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
      <View style={[styles.weekdays, { borderBottomColor: theme.calendarBorder }]}>
        {WEEKDAY_LABELS.map((label, index) => (
          <Text
            key={label}
            testID="month-calendar.weekday"
            accessibilityLabel={`${label}曜日`}
            style={[
              styles.weekday,
              { color: theme.textSecondary },
              index === 5 && { color: theme.calendarSaturday },
              index === 6 && { color: theme.calendarHoliday },
            ]}
          >
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  weekdays: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 2,
    paddingBottom: 4,
  },
  weekday: { flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '600' },
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
