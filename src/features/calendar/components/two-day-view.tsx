import { Radii, Spacing, Typography } from '@/constants/theme';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type PanResponderInstance,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { SegmentedControl } from '@/shared/components/segmented-control';
import { useTheme } from '@/hooks/use-theme';
import { useNowIndicator } from '../hooks/use-now-indicator';
import { FOCUSED_TIMELINE_FACTOR, type TimelinePreset, type TimelineZoomSelection, useTimelinePresetZoom } from '../hooks/use-timeline-preset-zoom';
import { MINUTES_PER_DAY, NOW_LINE_HEIGHT, TIMELINE_HEIGHT, computeNowLineTop, getTimelineAxisLineHeight, getTimelineItemFrame } from '../timeline-layout';
import { createTwoDayAllDayLayout, getAllDayBand, getVisibleAllDayRows, type TwoDayViewModel } from '../two-day-view-model';
import { TimelineAxis } from './timeline-axis';
import { TwoDayColumn } from './two-day-column';
import { TwoDayAllDayLayer } from './two-day-all-day-layer';
import { WeekDayHeader } from './week-day-header';
import { createWeekStripLayout, getWeekHeaderHeight } from '../week-view-layout';
import { createTimelineTouchSession } from '../timeline-touch-session';
import { SingleDaySummary } from './single-day-summary';
import { AllDayList } from './all-day-list';
import type { SavedCalendarEvent } from '../calendar-refresh-context';

export function TwoDayView({
  strip, bufferDays, columnWidth, translateX, panHandlers, onCarouselLayout, now, onEditEvent, onCreateExactAt,
  visibleDayCount = 2, selectedDate, onOpenDay, renderBottomBar, savedEvent, initialZoom, onZoomChange,
  todayRequest = 0,
}: Readonly<{
  /** 予備列→表示2日→予備列の順に並んだ日付の並び。 */
  strip: readonly TwoDayViewModel[];
  bufferDays: number;
  /** 1列(1日分)の幅。カルーセルの計測結果をそのまま各列の幅として使う。 */
  columnWidth: number;
  translateX: Animated.Value;
  panHandlers: PanResponderInstance['panHandlers'];
  /** カルーセルが基準位置・スライド距離を計算するための画面幅の計測結果を通知する。 */
  onCarouselLayout(width: number): void;
  onEditEvent?(id: string, originalOccurrenceDate?: string): void;
  onCreateExactAt?(date: string, startTime: string): void;
  now?: () => Date;
  visibleDayCount?: 1 | 2 | 7;
  selectedDate?: string;
  savedEvent?: SavedCalendarEvent | null;
  initialZoom?: TimelineZoomSelection;
  onZoomChange?(selection: TimelineZoomSelection): void;
  todayRequest?: number;
  onOpenDay?(date: string): void;
  renderBottomBar?(zoomControl: ReactNode): ReactNode;
}>) {
  // 時間軸の表示倍率は、ヘッダーなどを除いた実測の高さに対して決める。
  const { fontScale } = useWindowDimensions();
  const [fitScale, setFitScale] = useState(1);
  const [availableHeight, setAvailableHeight] = useState(600);
  const reduceMotion = useReduceMotion();
  const theme = useTheme();
  const [allDayDate, setAllDayDate] = useState<string | null>(null);
  const listDay = strip.find((day) => day.date === allDayDate);
  const headerHeight = visibleDayCount === 7 ? getWeekHeaderHeight(availableHeight, fontScale)
    : Math.ceil((visibleDayCount === 1 ? 44 : 58) * Math.max(1, Math.min(1.5, fontScale)));
  const axisLineHeight = getTimelineAxisLineHeight(fontScale);
  const axisPadding = Math.ceil(axisLineHeight / 2);
  const { laneLimit, rowHeight, height: allDayHeight } = useMemo(
    () => getAllDayBand(availableHeight, headerHeight, fontScale), [availableHeight, headerHeight, fontScale],
  );
  const [tapGuard] = useState(createTimelineTouchSession);
  const presetZoom = useTimelinePresetZoom(reduceMotion, initialZoom, onZoomChange);
  const { beginPinch, endPinch, updatePinch, isPinching } = presetZoom;
  const scale = presetZoom.factor * fitScale;
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const followInitialPosition = useRef(true);
  const revealPosition = useRef<{ revision: number; follow: boolean } | null>(null);
  const handleTimelineLayout = useCallback((event: LayoutChangeEvent) => {
    const viewportHeight = Math.max(1, event.nativeEvent.layout.height - 2 * axisPadding);
    setFitScale(viewportHeight / TIMELINE_HEIGHT);
  }, [axisPadding]);
  const pinch = useMemo(() => Gesture.Pinch()
    .runOnJS(true)
    .onBegin(beginPinch)
    .onUpdate((event) => updatePinch(event.scale))
    .onEnd(endPinch)
    .onFinalize(endPinch), [beginPinch, endPinch, updatePinch]);

  useEffect(() => {
    if (!isPinching) return;
    if (revealPosition.current !== null) revealPosition.current.follow = false;
  }, [isPinching]);

  const indicator = useNowIndicator(now);
  const nowTop = computeNowLineTop(indicator.minutesOfDay, scale);

  const stripWidth = strip.length * columnWidth;
  const weekLayout = useMemo(() => visibleDayCount === 7 ? createWeekStripLayout(strip, scale, columnWidth, laneLimit) : null,
    [visibleDayCount, strip, scale, columnWidth, laneLimit]);
  const allDayLayout = useMemo(() => weekLayout?.allDayLayout ?? createTwoDayAllDayLayout(strip, laneLimit),
    [strip, laneLimit, weekLayout]);
  const timelineStrip = weekLayout?.strip ?? strip;
  const timelineHeight = TIMELINE_HEIGHT * scale;
  const isTimelineScrollable = scale > fitScale + 0.001;
  const targetBandHeight = rowHeight * getVisibleAllDayRows(allDayLayout, bufferDays, visibleDayCount, laneLimit);
  const [bandHeight] = useState(() => new Animated.Value(targetBandHeight));
  const summaryHeight = useMemo(() => Animated.add(bandHeight, headerHeight), [bandHeight, headerHeight]);
  useEffect(() => {
    if (reduceMotion) {
      bandHeight.setValue(targetBandHeight);
      return;
    }
    const transition = Animated.timing(bandHeight, {
      toValue: targetBandHeight,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
      isInteraction: false,
    });
    transition.start();
    return () => transition.stop();
  }, [bandHeight, reduceMotion, targetBandHeight]);

  const visibleDays = timelineStrip.slice(bufferDays, bufferDays + visibleDayCount);
  const firstVisibleDate = visibleDays[0]?.date;
  const savedDayIndex = savedEvent == null ? -1 : visibleDays.findIndex((day) => day.date === savedEvent.date);
  const savedTimelineItem = savedDayIndex < 0 ? undefined
    : visibleDays[savedDayIndex].timelineItems.find((item) => item.eventId === savedEvent?.id);
  const revealRevision = savedEvent?.revision;
  const offsetLimit = Math.max(0, timelineHeight - TIMELINE_HEIGHT * fitScale);
  // 表示中の日付にかかわらず、現在時刻を時間軸の中央に置く。
  const initialTarget = indicator.minutesOfDay * timelineHeight / MINUTES_PER_DAY - TIMELINE_HEIGHT * fitScale / 2;
  const defaultOffset = Math.min(offsetLimit, Math.max(0, initialTarget));
  const savedOffset = savedTimelineItem === undefined ? null : Math.min(offsetLimit,
    Math.max(0, getTimelineItemFrame(savedTimelineItem, scale).top - TIMELINE_HEIGHT * fitScale * 0.2));
  const [initialOffset] = useState(() => ({ x: 0, y: savedOffset ?? defaultOffset }));
  const syncOffset = useCallback(() => {
    if (savedOffset !== null && revealRevision !== undefined) {
      if (revealPosition.current?.revision !== revealRevision) {
        revealPosition.current = { revision: revealRevision, follow: true };
        followInitialPosition.current = false;
      }
      if (revealPosition.current.follow) {
        scrollRef.current?.scrollTo({ y: savedOffset, animated: false });
        return;
      }
    }
    if (followInitialPosition.current) scrollRef.current?.scrollTo({ y: defaultOffset, animated: false });
  }, [defaultOffset, revealRevision, savedOffset]);
  useLayoutEffect(() => {
    followInitialPosition.current = true;
    if (revealPosition.current !== null) revealPosition.current.follow = false;
  }, [firstVisibleDate, todayRequest]);
  useLayoutEffect(() => {
    syncOffset();
  }, [syncOffset, firstVisibleDate, todayRequest]);

  const selectPreset = (preset: TimelinePreset) => {
    if (revealPosition.current !== null) revealPosition.current.follow = false;
    if (preset === 'focused') {
      followInitialPosition.current = true;
      if (presetZoom.factor === FOCUSED_TIMELINE_FACTOR) syncOffset();
    }
    presetZoom.selectPreset(preset);
  };

  const zoomControl = (
    <View style={styles.zoomControl}>
      <SegmentedControl
        options={[{ value: 'focused', label: '6時間' }, { value: 'full', label: '24時間' }]}
        value={presetZoom.preset} label="時間軸の表示範囲" onSelect={selectPreset} />
    </View>
  );

  const timeline = (
    <View collapsable={false} style={styles.fill}>
      <ScrollView ref={scrollRef} testID="two-day-calendar.timeline-scroll" style={styles.fill}
        contentOffset={initialOffset} onContentSizeChange={syncOffset}
        onScrollBeginDrag={() => {
          followInitialPosition.current = false;
          if (revealPosition.current !== null) revealPosition.current.follow = false;
        }}
        contentContainerStyle={{ height: timelineHeight + 2 * axisPadding, paddingTop: axisPadding }} scrollEnabled={isTimelineScrollable}
        showsVerticalScrollIndicator={isTimelineScrollable} bounces={isTimelineScrollable}>
        <View style={[styles.timelineRow, { height: timelineHeight }]}>
          <View testID="two-day-calendar.timeline-zoom" accessible accessibilityRole="adjustable"
            accessibilityLabel="時間軸、表示倍率"
            accessibilityValue={{ min: Math.round(fitScale * 100), max: Math.round(fitScale * FOCUSED_TIMELINE_FACTOR * 100), now: Math.round(scale * 100) }}
            accessibilityActions={[{ name: 'increment', label: '拡大' }, { name: 'decrement', label: '縮小' }]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === 'increment') selectPreset('focused');
              if (event.nativeEvent.actionName === 'decrement') selectPreset('full');
            }}>
            <TimelineAxis scale={scale} lineHeight={axisLineHeight}
              now={{ top: nowTop, label: indicator.label }} />
          </View>
          <View style={styles.viewport}>
            <Animated.View testID="two-day-calendar.timeline-strip"
              style={[styles.stripRow, { width: stripWidth, transform: [{ translateX }] }]}>
              {timelineStrip.map((day, index) => (
                <TwoDayColumn key={day.date} day={day} variant="timeline" scale={scale} columnWidth={columnWidth}
                  savedItemId={index === bufferDays + savedDayIndex ? savedTimelineItem?.id : undefined}
                  hidden={visibleDayCount !== 2 && (index < bufferDays || index >= bufferDays + visibleDayCount)} compactTimeline={visibleDayCount === 7} tapGuard={tapGuard}
                  onEditEvent={onEditEvent} onCreateExactAt={isPinching ? undefined : onCreateExactAt} />
              ))}
            </Animated.View>
            <View testID="two-day-calendar.now-line" pointerEvents="none"
              style={[styles.nowLine, { top: nowTop, backgroundColor: theme.calendarNowIndicator }]} />
            <View testID="two-day-calendar.now-dot" pointerEvents="none"
              style={[styles.nowDot, { top: nowTop - 3, backgroundColor: theme.calendarNowIndicator }]} />
          </View>
        </View>
      </ScrollView>
    </View>
  );

  return (
    <View testID={visibleDayCount === 7 ? 'week-calendar' : visibleDayCount === 1 ? 'single-day-calendar' : 'two-day-calendar'} style={styles.container} {...(isPinching ? {} : panHandlers)}
      onTouchStart={(event) => tapGuard.start(event.nativeEvent.touches?.length ?? 0)}
      onTouchCancel={() => tapGuard.cancel()}
      onLayout={(event) => setAvailableHeight(event.nativeEvent.layout.height)}>
      <Animated.View testID="two-day-calendar.summary" style={[styles.summaryRow, { height: summaryHeight }]}>
        <View style={styles.axisSpacer}>
          <View style={[styles.allDayCaption, { top: headerHeight, height: rowHeight }]}>
            <Text testID="two-day-calendar.all-day-caption" style={[styles.allDayLabel, { color: theme.textSecondary }]} numberOfLines={1}
              adjustsFontSizeToFit>終日</Text>
          </View>
        </View>
        <View
          testID="two-day-calendar.day-columns-viewport"
          style={styles.viewport}
          // 時間軸(48pt)を除いた、実際に日付列が占める幅を計測する。ルート全体の
          // 幅を使うと、その分だけ列の幅が広く計算され、右側の列がはみ出してしまう。
          onLayout={(event) => onCarouselLayout(event.nativeEvent.layout.width)}
        >
          <Animated.View testID="two-day-calendar.summary-strip"
            style={[styles.stripRow, { width: stripWidth, transform: [{ translateX }] }]}>
            {strip.map((day, index) => {
              const hidden = index < bufferDays || index >= bufferDays + visibleDayCount;
              const hiddenAllDayCount = allDayLayout.hiddenCounts[index];
              if (visibleDayCount === 7) return <WeekDayHeader key={day.date} day={day} height={headerHeight} columnWidth={columnWidth}
                allDayHeight={allDayHeight} hiddenCount={weekLayout?.hiddenCounts[index] ?? 0} selected={day.date === selectedDate}
                hiddenAllDayCount={hiddenAllDayCount} hidden={hidden} onOpenDay={onOpenDay} onOpenAllDayList={setAllDayDate} />;
              if (visibleDayCount === 1) return <SingleDaySummary key={day.date} day={day} hidden={hidden}
                headerHeight={headerHeight} columnWidth={columnWidth} allDayHeight={allDayHeight} hiddenCount={hiddenAllDayCount} onOpenAllDayList={setAllDayDate} />;
              return <TwoDayColumn key={day.date} day={day} headerHeight={headerHeight} columnWidth={columnWidth}
                sharedAllDayHeight={allDayHeight} hiddenAllDayItemCount={hiddenAllDayCount} onOpenAllDayList={setAllDayDate} />;
            })}
            <TwoDayAllDayLayer layout={allDayLayout} columnWidth={columnWidth} height={allDayHeight}
              rowHeight={rowHeight} visibleStartIndex={bufferDays} visibleDayCount={visibleDayCount}
              top={headerHeight} hideOffscreen={visibleDayCount !== 2} onEditEvent={onEditEvent}
              savedEventId={savedDayIndex < 0 ? undefined : savedEvent?.id} savedDayIndex={bufferDays + savedDayIndex} />
          </Animated.View>
        </View>
      </Animated.View>
      <View testID="two-day-calendar.timeline" style={styles.timelineViewport} onLayout={handleTimelineLayout}>
        <GestureDetector gesture={pinch}>{timeline}</GestureDetector>
        {visibleDays.length > 0 && visibleDays.every((day) => day.timelineItems.length === 0 && day.allDayItems.length === 0) ? (
          <View pointerEvents="none" style={styles.empty}>
            <Text style={{ color: theme.textSecondary }}>この期間に予定はありません</Text>
          </View>
        ) : null}
      </View>
      {renderBottomBar ? renderBottomBar(zoomControl) : <View style={styles.toolbar}>{zoomControl}</View>}
      {listDay !== undefined ? <AllDayList day={listDay} reduceMotion={reduceMotion}
        onClose={() => setAllDayDate(null)} onEditEvent={onEditEvent} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', flex: 1 },
  fill: { flex: 1 },
  summaryRow: { flexDirection: 'row', width: '100%', overflow: 'hidden' },
  toolbar: { flexDirection: 'row', paddingHorizontal: Spacing.twelve, paddingVertical: Spacing.one },
  zoomControl: { width: '46%', maxWidth: 208, minWidth: 100 },
  axisSpacer: { width: 48 },
  allDayCaption: { position: 'absolute', width: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.one },
  allDayLabel: { fontSize: Typography.caption, fontWeight: '400' },
  // 予備列は基準位置から外れた分だけ隠す。表示2日の描画内容自体は変えない。
  viewport: { flex: 1, minWidth: 0, overflow: 'hidden' },
  stripRow: { position: 'absolute', top: 0, bottom: 0, left: 0, flexDirection: 'row' },
  empty: { position: 'absolute', alignSelf: 'center', top: Spacing.twelve, padding: Spacing.two },
  timelineViewport: { width: '100%', flex: 1, overflow: 'hidden' },
  timelineRow: { flexDirection: 'row', width: '100%' },
  nowLine: { position: 'absolute', left: 0, right: 0, height: NOW_LINE_HEIGHT, zIndex: 2 },
  nowDot: { position: 'absolute', left: 0, width: 7, height: 7, borderRadius: Radii.full, zIndex: 3 },
});
