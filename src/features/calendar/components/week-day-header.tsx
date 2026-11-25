import { Radii, Spacing, Typography } from '@/constants/theme';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import type { TwoDayViewModel } from '../two-day-view-model';
import { AllDayRegion } from './all-day-region';

export function WeekDayHeader({ day, hiddenCount, height, columnWidth, allDayHeight, selected, hidden, hiddenAllDayCount, onOpenDay, onOpenAllDayList }: Readonly<{
  day: TwoDayViewModel;
  hiddenCount: number;
  hiddenAllDayCount: number;
  onOpenAllDayList(date: string): void;
  height: number;
  columnWidth?: number;
  allDayHeight: number;
  selected: boolean;
  hidden: boolean;
  onOpenDay?(date: string): void;
}>) {
  const theme = useTheme();
  const dateColor = day.holidayName !== null || day.weekdayLabel === '日' ? theme.calendarHoliday
    : day.weekdayLabel === '土' ? theme.calendarSaturday : theme.text;
  return <View testID={`week-day-header.${day.date}`} style={[styles.column, columnWidth === undefined ? styles.flexColumn : { width: columnWidth }, { height: height + allDayHeight, borderColor: theme.calendarBorder }]}
    accessibilityElementsHidden={hidden} importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}>
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={() => onOpenDay?.(day.date)}
      accessibilityLabel={`${day.accessibilityLabel}${hiddenCount > 0 ? `、他${hiddenCount}件` : ''}、1日表示を開く`}
      style={[styles.header, { height, borderBottomColor: selected ? theme.calendarAccent : theme.calendarBorder, borderBottomWidth: selected ? 2 : StyleSheet.hairlineWidth }]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} nestedScrollEnabled>
      <Text numberOfLines={1} style={[styles.weekday, { color: dateColor }]}>{day.weekdayLabel}</Text>
      <Text numberOfLines={1} style={[styles.date, { color: day.isToday ? theme.background : dateColor,
        backgroundColor: day.isToday ? theme.calendarAccent : 'transparent' }]}>{Number(day.date.slice(8, 10))}</Text>
      <Text style={[styles.more, { color: theme.textSecondary }]}>{hiddenCount > 0 ? `他${hiddenCount}件` : ' '}</Text>
      </ScrollView>
    </Pressable>
    <AllDayRegion day={day} height={allDayHeight} hiddenCount={hiddenAllDayCount} compact onOpenAllDayList={onOpenAllDayList} />
  </View>;
}

const styles = StyleSheet.create({
  flexColumn: { flex: 1 },
  column: { minWidth: 0, overflow: 'hidden', borderLeftWidth: StyleSheet.hairlineWidth },
  header: { minHeight: 44, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  scroll: { width: '100%' }, scrollContent: { alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
  weekday: { fontSize: Typography.caption }, date: { fontSize: Typography.row, borderRadius: Radii.large, paddingHorizontal: Spacing.half }, more: { fontSize: Typography.caption, width: '100%', textAlign: 'center' } });
