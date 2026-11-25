import { Radii, Spacing, Typography } from '@/constants/theme';
import { Link } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MonthDayViewModel } from '../month-view-model';
import { useTheme } from '@/hooks/use-theme';
import { useId, type ReactNode } from 'react';

const MONTH_DAY_CIRCLE_SIZE = 22;
const MONTH_DAY_PADDING_TOP = 2;
export const MONTH_HOLIDAY_LINE_HEIGHT = 13;
export const MONTH_DAY_HEADER_HEIGHT = MONTH_DAY_CIRCLE_SIZE + MONTH_DAY_PADDING_TOP * 2;

export type MonthDayCellProps = Readonly<{
  day: MonthDayViewModel;
  onPress(date: string): void;
  onOpenDay?(date: string): void;
  variant?: 'month' | 'picker';
  renderDayPreview?(date: string): ReactNode;
}>;

export function MonthDayCell({ day, onPress, onOpenDay, renderDayPreview, variant = 'month' }: MonthDayCellProps) {
  const requestId = useId();
  const theme = useTheme();
  const isHoliday = day.holidayName !== null || day.weekday === 0;
  const isSaturday = day.weekday === 6;
  const hasFixedEvents = day.hasFixedEvents ?? day.hasEvents;

  const isFullMonth = variant === 'month' && onOpenDay !== undefined;

  // Link.Triggerが合成できる静的styleで、日付セル全体をネイティブの操作対象にする。
  const content = (
    <Pressable
      role="button"
      accessibilityLabel={onOpenDay === undefined ? day.accessibilityLabel : `${day.accessibilityLabel}を開く`}
      accessibilityState={{ selected: day.isSelected }}
      onPress={(event) => {
        if (onOpenDay !== undefined) {
          event.preventDefault();
          onOpenDay(day.date);
          return;
        }
        onPress(day.date);
      }}
      style={StyleSheet.flatten([
        styles.cell,
        isFullMonth && [styles.monthCell, { borderRightColor: theme.controlBorder }],
        day.isSelected && { backgroundColor: theme.backgroundSelected },
        !day.isCurrentMonth && styles.inactive,
      ])}
    >
      {({ pressed }) => (
        <View pointerEvents="none" style={[styles.dayContent, isFullMonth && styles.fullDayContent, pressed && styles.pressed]}>
          <View
            testID={`month-calendar.day-circle.${day.date}`}
            style={[
              styles.dayCircle,
              isFullMonth && styles.monthDayCircle,
              day.isToday && { backgroundColor: theme.calendarAccent },
            ]}
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
          {isFullMonth ? day.holidayName === null ? null : (
            <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[styles.holiday, { color: theme.calendarHoliday }]}>
              {day.holidayName}
            </Text>
          ) : (
            <>
              <View
                testID={`month-calendar.event-dot.${day.date}`}
                accessibilityElementsHidden
                importantForAccessibility="no"
                style={[
                  styles.eventDot,
                  { backgroundColor: theme.calendarAccent },
                  !hasFixedEvents && styles.hidden,
                ]}
              />
              <View
                testID={`month-calendar.fuzzy-range-bar.${day.date}`}
                accessibilityElementsHidden
                importantForAccessibility="no"
                style={[
                  styles.fuzzyRangeBar,
                  { borderColor: theme.calendarAccent },
                  !day.hasFuzzyRangeEvents && styles.hidden,
                ]}
              />
            </>
          )}
        </View>
      )}
    </Pressable>
  );
  if (onOpenDay === undefined || Platform.OS !== 'ios') return content;
  return (
    <View testID={`month-calendar.day-link.${day.date}`} style={styles.linkCell}>
      <Link asChild href={{ pathname: '/calendar/day/[date]', params: { date: day.date, request: requestId } }}>
        <Link.Trigger>{content}</Link.Trigger>
        <Link.Preview style={{ backgroundColor: theme.background }}>
          {renderDayPreview?.(day.date)}
        </Link.Preview>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  linkCell: { flex: 1, flexBasis: 0, minWidth: 0 },
  cell: {
    flex: 1,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthCell: { flexBasis: 0, minWidth: 0, minHeight: 0, justifyContent: 'flex-start', paddingTop: MONTH_DAY_PADDING_TOP, borderRightWidth: StyleSheet.hairlineWidth },
  dayContent: { alignItems: 'center' },
  fullDayContent: { alignSelf: 'stretch', minWidth: 0 },
  holiday: { fontSize: Typography.caption, lineHeight: MONTH_HOLIDAY_LINE_HEIGHT, maxWidth: '100%', paddingHorizontal: Spacing.half },
  dayCircle: { width: 30, height: 30, borderRadius: Radii.full, alignItems: 'center', justifyContent: 'center' },
  monthDayCircle: {
    width: MONTH_DAY_CIRCLE_SIZE,
    height: MONTH_DAY_CIRCLE_SIZE,
    borderRadius: Radii.full,
  },
  dayNumber: { fontSize: Typography.body, fontWeight: '400', lineHeight: 18 },
  eventDot: { width: 4, height: 4, borderRadius: Radii.full, marginTop: Spacing.half },
  fuzzyRangeBar: { width: 14, height: 4, borderWidth: 1, borderStyle: 'dashed', borderRadius: Radii.small, marginTop: Spacing.half },
  hidden: { opacity: 0 },
  inactive: { opacity: 0.45 },
  pressed: { opacity: 0.65 },
});
