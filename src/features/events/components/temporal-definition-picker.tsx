import { differenceInCalendarDays, parseISO } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Radii, Spacing, Typography } from '@/constants/theme';
import type { TemporalDefinition, TemporalGranularity } from '@/domain/temporal/temporal-definition';
import { createDateRangeOpacityStops } from '@/features/calendar/date-range-gradient';
import { createOpacityStops, MINUTES_PER_DAY } from '@/features/calendar/timeline-layout';
import { useTheme } from '@/hooks/use-theme';
import { EventSingleSelectField } from './event-single-select-field';

type PreviewDateRange = Readonly<{ startDate: string; endDate: string }>;

type TemporalDefinitionPickerProps = Readonly<{
  definitions: readonly TemporalDefinition[];
  selectedId: string | null;
  relativeRange?: PreviewDateRange | null;
  previewColor?: string;
  disabled: boolean;
  onSelect(id: string): void;
}>;

const GRANULARITY_GROUPS = [
  { id: 'day', label: 'この日' },
  { id: 'week', label: '週単位' },
  { id: 'month', label: '月単位' },
] as const satisfies readonly { id: TemporalGranularity; label: string }[];
const MINIMUM_CLOCK_BAR_OPACITY = 0.25;

function percentage(value: number): `${number}%` {
  return `${value * 100}%`;
}

function PreviewGradient({ color, stops, testID, segment, minimumOpacity = 0 }: Readonly<{
  color: string;
  stops: readonly Readonly<{ offset: number; opacity: number }>[];
  testID: string;
  segment: ViewStyle;
  minimumOpacity?: number;
}>) {
  const [first, second, ...rest] = stops;
  const shade = ({ opacity }: { opacity: number }) => {
    const alpha = minimumOpacity + (1 - minimumOpacity) * opacity;
    return `${color}${Math.round(255 * alpha).toString(16).padStart(2, '0')}`;
  };
  return (
    <LinearGradient testID={testID} colors={[shade(first), shade(second), ...rest.map(shade)]}
      locations={[first.offset, second.offset, ...rest.map((stop) => stop.offset)]}
      start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
      style={[styles.segment, segment]} />
  );
}

function TemporalRangePreview({ definition, relativeRange, color }: Readonly<{
  definition: TemporalDefinition;
  relativeRange?: PreviewDateRange | null;
  color: string;
}>) {
  const theme = useTheme();
  const config = definition.resolverConfig;
  const track = [styles.track, { backgroundColor: theme.backgroundElement }];
  if (config.kind === 'timeOfDay') {
    const { startMinute, endMinute } = config;
    const continuesNextDay = endMinute > MINUTES_PER_DAY;
    const segments = [{ id: 'start', start: startMinute, end: Math.min(endMinute, MINUTES_PER_DAY) }];
    if (continuesNextDay) {
      segments.push({ id: 'next-day', start: MINUTES_PER_DAY, end: endMinute });
    }
    return (
      <View style={styles.preview}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={track}>
          {segments.map(({ id, start, end }) => (
            <PreviewGradient key={id} testID={`event-editor.temporal-bar.${definition.id}.${id}`}
              color={color} minimumOpacity={MINIMUM_CLOCK_BAR_OPACITY}
              // 日付境界で分けた後も、範囲全体のぼかしを切り出して表示する。
              stops={createOpacityStops({
                rangeStart: startMinute, rangeEnd: endMinute, clipStart: start, clipEnd: end,
                fadeInRatio: definition.fadeInRatio, fadeOutRatio: definition.fadeOutRatio,
              })}
              segment={{
                left: percentage((start % MINUTES_PER_DAY) / MINUTES_PER_DAY),
                width: percentage((end - start) / MINUTES_PER_DAY),
              }} />
          ))}
        </View>
        {continuesNextDay ? <Text style={[styles.note, { color: theme.textSecondary }]}>翌日まで</Text> : null}
      </View>
    );
  }

  if (!relativeRange) return null;
  const { startDate, endDate } = relativeRange;
  const days = differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={track}>
      <PreviewGradient testID={`event-editor.temporal-bar.${definition.id}.relative`}
        color={color} segment={styles.fullSpan}
        stops={createDateRangeOpacityStops({
          rangeStartDate: startDate, rangeThroughDate: endDate, clipStartDate: startDate, clipThroughDate: endDate,
          fadeInRatio: definition.fadeInRatio, fadeOutRatio: definition.fadeOutRatio,
        })} />
      {Array.from({ length: days - 1 }, (_, index) => (
        <View key={index} testID="event-editor.temporal-day-boundary"
          style={[styles.boundary, { left: percentage((index + 1) / days), backgroundColor: theme.calendarBorder }]} />
      ))}
    </View>
  );
}

export function TemporalDefinitionPicker({
  definitions, selectedId, relativeRange, previewColor, disabled, onSelect,
}: TemporalDefinitionPickerProps) {
  const theme = useTheme();
  const selected = definitions.find((definition) => definition.id === selectedId) ?? definitions[0];
  if (!selected) {
    return <Text style={{ color: theme.textSecondary }}>利用できる時間帯がありません</Text>;
  }

  const options = GRANULARITY_GROUPS.flatMap(({ id, label }) => definitions
    .filter((definition) => definition.granularity === id)
    .map((definition) => ({ value: definition.id, label: definition.label, group: label })));

  return (
    <View testID="event-editor.temporal-definition-picker" style={styles.picker}>
      <EventSingleSelectField label="ざっくり種別" value={selected.id} options={options}
        testID="event-editor.temporal-definition-select" disabled={disabled} onChange={onSelect} />
      <TemporalRangePreview definition={selected} relativeRange={relativeRange}
        color={previewColor ?? theme.calendarAccent} />
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { gap: Spacing.two },
  preview: { gap: Spacing.one },
  track: { borderRadius: Radii.small, height: Spacing.twelve, overflow: 'hidden' },
  segment: { position: 'absolute', top: 0, bottom: 0 },
  fullSpan: { left: 0, right: 0 },
  boundary: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
  note: { fontSize: Typography.caption },
});
