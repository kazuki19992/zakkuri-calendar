import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import type { TwoDayViewModel } from '../two-day-view-model';

export function WeekDayHeader({ day, hiddenCount, height, allDayHeight, selected, hidden, onOpenDay }: Readonly<{
  day: TwoDayViewModel;
  hiddenCount: number;
  height: number;
  allDayHeight: number;
  selected: boolean;
  hidden: boolean;
  onOpenDay?(date: string): void;
}>) {
  const theme = useTheme();
  const dateColor = day.holidayName !== null || day.weekdayLabel === '日' ? theme.calendarHoliday
    : day.weekdayLabel === '土' ? theme.calendarSaturday : theme.text;
  return <View testID={`week-day-header.${day.date}`} style={[styles.column, { height: height + allDayHeight, borderColor: theme.calendarBorder }]}
    accessibilityElementsHidden={hidden} importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}>
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={() => onOpenDay?.(day.date)}
      accessibilityLabel={`${day.accessibilityLabel}${hiddenCount > 0 ? `、他${hiddenCount}件` : ''}、1日表示を開く`}
      style={[styles.header, { height, borderBottomColor: selected ? theme.calendarAccent : theme.calendarBorder, borderBottomWidth: selected ? 2 : StyleSheet.hairlineWidth }]}>
      <Text numberOfLines={1} style={[styles.weekday, { color: dateColor }]}>{day.weekdayLabel}</Text>
      <Text numberOfLines={1} style={[styles.date, { color: day.isToday ? theme.background : dateColor,
        backgroundColor: day.isToday ? theme.calendarAccent : 'transparent' }]}>{Number(day.date.slice(8, 10))}</Text>
      <Text numberOfLines={1} style={[styles.more, { color: theme.textSecondary }]}>{hiddenCount > 0 ? `他${hiddenCount}件` : day.holidaySupport === 'unsupported' ? '祝日未対応' : ' '}</Text>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({ column: { flex: 1, minWidth: 0, borderRightWidth: StyleSheet.hairlineWidth },
  header: { minHeight: 44, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  weekday: { fontSize: 11 }, date: { fontSize: 16, borderRadius: 12, paddingHorizontal: 2 }, more: { fontSize: 10 } });
