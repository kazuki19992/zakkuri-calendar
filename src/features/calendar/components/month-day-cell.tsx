import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MonthDayViewModel } from '../month-view-model';
import { useTheme } from '@/hooks/use-theme';

export type MonthDayCellProps = Readonly<{
  day: MonthDayViewModel;
  onPress(date: string): void;
  variant?: 'month' | 'picker';
}>;

export function MonthDayCell({ day, onPress, variant = 'month' }: MonthDayCellProps) {
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
        variant === 'picker' && styles.pickerCell,
        day.isSelected && { backgroundColor: theme.backgroundSelected },
        !day.isCurrentMonth && styles.inactive,
        pressed && styles.pressed,
      ]}
    >
      <View
        testID={`month-calendar.day-circle.${day.date}`}
        style={[styles.dayCircle, day.isToday && { backgroundColor: theme.calendarAccent }]}
      >
        <Text
          style={[
            styles.dayNumber,
            { color: theme.text },
            isSaturday && { color: theme.calendarSaturday },
            isHoliday && { color: theme.calendarHoliday },
            day.isToday && { color: theme.background },
          ]}
        >
          {day.dayNumber}
        </Text>
      </View>
      <View
        testID={`month-calendar.event-dot.${day.date}`}
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={[
          styles.eventDot,
          { backgroundColor: theme.calendarAccent },
          !day.hasEvents && styles.hidden,
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerCell: { minHeight: 44 },
  dayCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  dayNumber: { fontSize: 14, fontWeight: '500', lineHeight: 18 },
  eventDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  hidden: { opacity: 0 },
  inactive: { opacity: 0.45 },
  pressed: { opacity: 0.65 },
});
