import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MonthDayViewModel } from '../month-view-model';
import { useTheme } from '@/hooks/use-theme';

export type MonthDayCellProps = Readonly<{
  day: MonthDayViewModel;
  onPress(date: string): void;
}>;

export function MonthDayCell({ day, onPress }: MonthDayCellProps) {
  const theme = useTheme();
  const isHoliday = day.holidayName !== null || day.weekday === 0;
  const isSaturday = day.weekday === 6;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={day.accessibilityLabel}
      accessibilityState={{ selected: day.isSelected }}
      onPress={() => onPress(day.date)}
      style={({ pressed }) => [
        styles.cell,
        day.isSelected && { backgroundColor: theme.calendarAccent },
        day.isToday && { borderColor: theme.calendarAccent },
        !day.isToday && { borderColor: 'transparent' },
        !day.isCurrentMonth && styles.inactive,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.dayNumber,
          { color: theme.text },
          isSaturday && { color: theme.calendarSaturday },
          isHoliday && { color: theme.calendarHoliday },
          day.isSelected && { color: theme.background },
        ]}
      >
        {day.dayNumber}
      </Text>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={[styles.eventDot, { backgroundColor: theme.calendarAccent }, !day.hasEvents && styles.hidden]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: 8,
    marginVertical: 1,
  },
  dayNumber: { fontSize: 15, fontWeight: '600', lineHeight: 18 },
  eventDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  hidden: { opacity: 0 },
  inactive: { opacity: 0.45 },
  pressed: { opacity: 0.65 },
});
