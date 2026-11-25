import { Spacing, Typography } from '@/constants/theme';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import type { TwoDayViewModel } from '../two-day-view-model';
import { AllDayRegion } from './all-day-region';

export function SingleDaySummary({ day, headerHeight, columnWidth, allDayHeight, hiddenCount, hidden = false, onOpenAllDayList }: Readonly<{
  day: TwoDayViewModel;
  headerHeight: number;
  columnWidth: number;
  allDayHeight: number;
  hiddenCount: number;
  hidden?: boolean;
  onOpenAllDayList?(date: string): void;
}>) {
  const theme = useTheme();
  return <View style={[styles.root, { width: columnWidth }]} accessibilityElementsHidden={hidden} importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}>
    <Text accessibilityRole="header" style={[styles.date, { height: headerHeight, color: day.isToday ? theme.calendarAccent : theme.text }]}>
      {day.dateLabel}（{day.weekdayLabel}）
    </Text>
    <AllDayRegion day={day} height={allDayHeight} hiddenCount={hiddenCount} onOpenAllDayList={onOpenAllDayList} />
  </View>;
}
const styles = StyleSheet.create({
  root: { minWidth: 0, overflow: 'hidden' },
  date: { textAlign: 'center', textAlignVertical: 'center', paddingVertical: Spacing.twelve, fontSize: Typography.row },
});
