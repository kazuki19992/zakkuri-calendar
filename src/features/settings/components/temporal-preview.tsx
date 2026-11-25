import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { Radii, Spacing, Typography } from '@/constants/theme';
import { resolveRelativeDateRange, type ThisWeekDeadlineWeekday } from '@/domain/temporal/relative-date-resolution';
import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';
import type { TemporalDefinitionPatch } from '@/domain/temporal/temporal-preferences';
import { createDateRangeOpacityStops } from '@/features/calendar/date-range-gradient';
import { createOpacityStops } from '@/features/calendar/timeline-layout';
import { useTheme } from '@/hooks/use-theme';
import { formatPercent } from '../temporal-preferences-model';
import { getClockTicks, getDayTicks, PreviewClockLabels, PreviewDayLabels, type ClockField } from './temporal-preview-scale';

const SNAP_STEPS = 20;
const HANDLE_SIZE = 44;

type FadeKey = 'fadeInRatio' | 'fadeOutRatio';

function snapRatio(value: number, other: number): number {
  const maxStep = Math.floor((1 - other) * SNAP_STEPS + 1e-8);
  return Math.max(0, Math.min(Math.round(value * SNAP_STEPS), maxStep)) / SNAP_STEPS;
}

function FadeHandle(props: Readonly<{
  edge: FadeKey;
  ratio: number;
  other: number;
  length: number;
  vertical: boolean;
  onChange(value: number): void;
  onDraggingChange(active: boolean): void;
  onSnap?(): void;
}>) {
  const { edge, ratio, other, length, vertical } = props;
  const theme = useTheme();
  const fromStart = edge === 'fadeInRatio';
  const offset = length * (fromStart ? ratio : 1 - ratio);
  const [dragging, setDragging] = useState(false);
  const session = useRef<{ origin: number; value: number; coordinate: number } | null>(null);
  const coordinate = ({ nativeEvent }: GestureResponderEvent) => vertical ? nativeEvent.pageY : nativeEvent.pageX;

  const startDrag = (event: GestureResponderEvent) => {
    session.current = { origin: ratio, value: ratio, coordinate: coordinate(event) };
    setDragging(true);
    props.onDraggingChange(true);
  };

  const moveDrag = (event: GestureResponderEvent) => {
    const drag = session.current;
    if (!drag || length <= 0 || event.nativeEvent.touches.length > 1) return;
    const delta = (coordinate(event) - drag.coordinate) / length;
    if (drag.value === drag.origin && Math.abs(delta) < 1 / (2 * SNAP_STEPS)) return;
    const next = snapRatio(drag.origin + (fromStart ? delta : -delta), other);
    if (next === drag.value) return;
    drag.value = next;
    props.onChange(next);
    props.onSnap?.();
  };

  const finishDrag = () => {
    session.current = null;
    setDragging(false);
    props.onDraggingChange(false);
  };
  const amount = Math.round(ratio * 100);

  return (
    <View accessible accessibilityRole="adjustable"
      onStartShouldSetResponder={() => true}
      onResponderGrant={startDrag}
      onResponderMove={moveDrag}
      onResponderRelease={finishDrag}
      onResponderTerminate={finishDrag}
      onResponderTerminationRequest={() => false}
      accessibilityLabel={fromStart ? '開始側のぼかし' : '終了側のぼかし'}
      accessibilityHint="上下にスワイプすると5%ずつ変わります。"
      accessibilityValue={{ min: 0, max: Math.round((1 - other) * 100), now: amount, text: formatPercent(ratio) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={({ nativeEvent }) => {
        const action = nativeEvent.actionName;
        if (action !== 'increment' && action !== 'decrement') return;
        const direction = action === 'increment' ? 1 : -1;
        const next = snapRatio(ratio + direction / SNAP_STEPS, other);
        if ((next - ratio) * direction > 0) props.onChange(next);
      }}
      style={[styles.handle, vertical
        ? { top: offset, left: fromStart ? '25%' : '70%', transform: [{ translateX: -HANDLE_SIZE / 2 }] }
        : { left: offset, top: fromStart ? '34%' : '60%', transform: [{ translateY: -HANDLE_SIZE / 2 }] }]}>
      <View pointerEvents="none" style={[styles.knob, { borderColor: theme.text, backgroundColor: theme.background }]} />
      {dragging ? (
        <Text pointerEvents="none" style={[styles.amount, { color: theme.text, backgroundColor: theme.background }]}>
          {formatPercent(ratio)}
        </Text>
      ) : null}
    </View>
  );
}

export function TemporalPreview({
  definition, deadlineWeekday = 5, onChange, onDraggingChange, onSnap,
  onEditClock, onAdjustFade, large = false,
}: Readonly<{
  definition: TemporalDefinition;
  deadlineWeekday?: ThisWeekDeadlineWeekday;
  onChange?(patch: TemporalDefinitionPatch): void;
  onDraggingChange?(active: boolean): void;
  onSnap?(): void;
  onEditClock?(field: ClockField): void;
  onAdjustFade?(): void;
  large?: boolean;
}>) {
  const theme = useTheme();
  const [track, setTrack] = useState({ width: 280, height: 0 });
  const config = definition.resolverConfig;
  const vertical = config.kind === 'timeOfDay';
  // 期間の表示例は実際のカレンダーと同じ規則で解決できる日を使う。
  const range = vertical ? null : resolveRelativeDateRange('2026-11-16', definition, deadlineWeekday);
  const singleDay = range?.ok && range.value.startDate === range.value.endDate;
  const valid = vertical
    ? config.endMinute > config.startMinute && config.endMinute - config.startMinute <= 1440
    : range?.ok === true;
  const height = vertical ? (large ? 294 : 172) : (large ? 132 : 78);
  const ticks = vertical ? getClockTicks(config.startMinute, config.endMinute, height) : [];
  const days = range?.ok ? getDayTicks(range.value.startDate, range.value.endDate, track.width) : [];
  const stops = vertical && valid
    ? createOpacityStops({
      rangeStart: config.startMinute, rangeEnd: config.endMinute, clipStart: config.startMinute, clipEnd: config.endMinute,
      fadeInRatio: definition.fadeInRatio, fadeOutRatio: definition.fadeOutRatio,
    })
    : range?.ok ? createDateRangeOpacityStops({
      rangeStartDate: range.value.startDate, rangeThroughDate: range.value.endDate,
      clipStartDate: range.value.startDate, clipThroughDate: range.value.endDate,
      fadeInRatio: definition.fadeInRatio, fadeOutRatio: definition.fadeOutRatio,
    }) : [{ offset: 0, opacity: 0 }, { offset: 1, opacity: 0 }];
  const color = theme.calendarEvent;

  return (
    <View style={styles.preview}>
      <Text accessibilityRole="header" style={{ color: theme.text, fontSize: Typography.row }}>表示のプレビュー</Text>
      {onChange && !singleDay ? (
        <Text style={{ color: theme.textSecondary }}>丸いつまみを動かして、予定の色が薄くなる範囲を調整できます。</Text>
      ) : null}
      <View style={[styles.axis, !vertical && styles.dayAxis]}>
        {vertical ? <PreviewClockLabels ticks={ticks} onEdit={onEditClock} /> : null}
        <View style={styles.plot}>
          <View testID="temporal-preview.track"
            onLayout={({ nativeEvent }) => {
              const { width, height: measuredHeight } = nativeEvent.layout;
              if (width > 0 && measuredHeight > 0) setTrack({ width, height: measuredHeight });
            }}
            style={[styles.track, { height, borderColor: theme.calendarBorder }]}>
            <LinearGradient testID="temporal-preview.gradient" style={styles.gradient}
              colors={stops.map((stop) => `${color}${Math.round(stop.opacity * 255).toString(16).padStart(2, '0')}`) as [string, string, ...string[]]}
              locations={stops.map((stop) => stop.offset) as [number, number, ...number[]]}
              start={{ x: 0, y: 0 }} end={vertical ? { x: 0, y: 1 } : { x: 1, y: 0 }} />
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              {ticks.map((tick, index) => <View key={index} testID={`temporal-preview.clock-line.${index}`}
                style={[styles.hourLine, { backgroundColor: theme.calendarBorder },
                  tick.position === 1 ? { bottom: 0 } : { top: `${tick.position * 100}%` }]} />)}
              {days.slice(1).map((day) => <View key={day.index} testID={`temporal-preview.day-boundary.${day.index}`}
                style={[styles.dayLine, { left: `${day.boundary * 100}%`, backgroundColor: theme.calendarBorder }]} />)}
            </View>
          </View>
          {!vertical && days.length > 0 ? <PreviewDayLabels days={days} /> : null}
        </View>
        {onChange && onDraggingChange && valid && !singleDay ? (
          <View pointerEvents="box-none" testID="temporal-preview.handles"
            style={[styles.handleLayer, { width: track.width + HANDLE_SIZE, height: height + HANDLE_SIZE }]}>
            {(['fadeInRatio', 'fadeOutRatio'] as const).map((edge) => (
              <FadeHandle key={edge} edge={edge} ratio={definition[edge]}
                other={definition[edge === 'fadeInRatio' ? 'fadeOutRatio' : 'fadeInRatio']}
                length={vertical ? track.height : track.width} vertical={vertical}
                onChange={(value) => onChange({ [edge]: value })}
                onDraggingChange={onDraggingChange} onSnap={onSnap} />
            ))}
          </View>
        ) : null}
      </View>
      {onAdjustFade && valid && !singleDay ? (
        <Pressable accessibilityRole="button" onPress={onAdjustFade}
          style={({ pressed }) => [styles.adjust, pressed && { opacity: 0.82 }]}>
          <Text style={{ color: theme.calendarAccentText }}>ぼかしを調整</Text>
        </Pressable>
      ) : null}
      {singleDay ? <Text style={{ color: theme.textSecondary }}>1日だけの期間はカレンダーで均一な色で表示します。</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { gap: Spacing.two },
  axis: { flexDirection: 'row', paddingVertical: HANDLE_SIZE / 2 + 4, paddingRight: HANDLE_SIZE / 2 },
  dayAxis: { paddingLeft: HANDLE_SIZE / 2, paddingBottom: 0 },
  plot: { flex: 1, minWidth: 0 },
  hourLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
  dayLine: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
  handleLayer: { position: 'absolute', top: 4, right: 0 },
  adjust: {
    minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: Spacing.twelve,
  },
  track: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radii.small, overflow: 'hidden' },
  gradient: { flex: 1 },
  handle: { position: 'absolute', width: HANDLE_SIZE, height: HANDLE_SIZE, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  knob: { width: 20, height: 20, borderRadius: Radii.full, borderWidth: 2 },
  amount: { position: 'absolute', minWidth: 36, top: 34, paddingHorizontal: Spacing.one, textAlign: 'center', fontSize: Typography.caption },
});
