import { Radii, Spacing, Typography } from '@/constants/theme';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { HOUR_LINE_THICKNESS, TIMELINE_HEIGHT, getHourLineTop } from '../timeline-layout';
import { resolveNearestTimelineHour } from '../timeline-tap-time';
import type { TwoDayViewModel } from '../two-day-view-model';
import { createTimelineTouchSession } from '../timeline-touch-session';
import { TimelineEventBlock } from './timeline-event-block';
import { AllDayRegion } from './all-day-region';

const hourLines = Array.from({ length: 25 }, (_, hour) => hour);


export function TwoDayColumn({ day, variant = 'summary', scale = 1, headerHeight = 58, sharedAllDayHeight = 44, hiddenAllDayItemCount = 0, onOpenAllDayList, hidden = false, compactTimeline = false, columnWidth, savedItemId, tapGuard, onEditEvent, onCreateExactAt }: Readonly<{
  day: TwoDayViewModel;
  variant?: 'summary' | 'timeline';
  scale?: number;
  headerHeight?: number;
  onOpenAllDayList?(date: string): void;
  sharedAllDayHeight?: number;
  hiddenAllDayItemCount?: number;
  hidden?: boolean;
  compactTimeline?: boolean;
  columnWidth?: number;
  savedItemId?: string;
  tapGuard?: ReturnType<typeof createTimelineTouchSession>;
  onEditEvent?(id: string, originalOccurrenceDate?: string): void;
  onCreateExactAt?(date: string, startTime: string): void;
}>) {
  const theme = useTheme();
  const lastTap = useRef<{ at: number; epoch: number } | null>(null);
  const [localTapGuard] = useState(createTimelineTouchSession);
  const session = tapGuard ?? localTapGuard;
  const widthStyle = columnWidth === undefined ? styles.flexColumn : { width: columnWidth };
  if (variant === 'timeline') {
    return (
      <View
        testID="two-day-calendar.timeline-column"
        accessibilityElementsHidden={hidden}
        importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
        style={[styles.timelineColumn, widthStyle, { height: TIMELINE_HEIGHT * scale, borderColor: theme.calendarBorder }]}
        onTouchStart={(event) => session.start(event.nativeEvent.touches?.length ?? 0)}
        onTouchCancel={() => { lastTap.current = null; session.cancel(); }}
        onTouchEnd={(event) => {
          if (session.isBlocked() || onCreateExactAt === undefined || (event.nativeEvent.touches?.length ?? 0) > 0) { lastTap.current = null; return; }
          const timestamp = Date.now();
          if (lastTap.current !== null && timestamp - lastTap.current.at <= 300 && lastTap.current.epoch === session.epoch()) {
            onCreateExactAt?.(day.date, resolveNearestTimelineHour(event.nativeEvent.locationY, scale));
            lastTap.current = null;
          } else lastTap.current = { at: timestamp, epoch: session.epoch() };
        }}
      >
        {day.timelineItems.map((item) => <TimelineEventBlock key={item.id} item={item} scale={scale} compact={compactTimeline}
          highlighted={savedItemId === item.id} onPress={onEditEvent} />)}
        {hourLines.map((hour) => (
          <View
            key={hour}
            testID="two-day-calendar.hour-line"
            // 予定ブロック(zIndex 1)の背後に描画し、予定の範囲・色・文字を
            // 罫線より優先して読み取れるようにする。
            // 表示のみが目的のため、下にある予定へのタップは妨げない。
            pointerEvents="none"
            style={[
              styles.hourLine,
              {
                top: getHourLineTop(hour, scale),
                backgroundColor: theme.calendarBorder,
              },
            ]}
          />
        ))}
      </View>
    );
  }
  return (
    <View testID="two-day-calendar.column" style={[styles.column, widthStyle, { borderColor: theme.calendarBorder }] }>
      <View testID="two-day-calendar.date-header" accessible accessibilityLabel={day.accessibilityLabel}
        style={[styles.header, { height: headerHeight, borderBottomColor: theme.calendarBorder }] }>
        <Text style={[styles.weekday, { color: theme.textSecondary }]}>{day.weekdayLabel}</Text>
        <View testID={day.isToday ? 'two-day-calendar.today-circle' : undefined}
          style={[styles.dateCircle, day.isToday && { backgroundColor: theme.calendarAccent }] }>
          <Text style={[styles.date, { color: day.isToday ? theme.calendarEventText : theme.text }] }>
            {Number(day.date.slice(8, 10))}
          </Text>
        </View>
      </View>
      <AllDayRegion day={day} height={sharedAllDayHeight} hiddenCount={hiddenAllDayItemCount} onOpenAllDayList={onOpenAllDayList} />
    </View>
  );
}

const styles = StyleSheet.create({
  flexColumn: { flex: 1 },
  column: { minWidth: 0, overflow: 'hidden', borderLeftWidth: StyleSheet.hairlineWidth },
  header: { minHeight: 58, paddingHorizontal: Spacing.one, paddingVertical: Spacing.one, alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  weekday: { fontSize: Typography.caption, lineHeight: 14 },
  dateCircle: { width: 34, height: 34, borderRadius: Radii.full, alignItems: 'center', justifyContent: 'center' },
  date: { fontSize: Typography.title, fontWeight: '400', lineHeight: 26 },
  timelineColumn: {
    minWidth: 0,
    position: 'relative',
    borderLeftWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  hourLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    // 高さ0 + borderTopWidthではなく、実体のある背景色付きの線として描画する。
    // 前者は端末によって描画が不安定になりやすい。
    height: HOUR_LINE_THICKNESS,
    zIndex: 0,
  },
});
