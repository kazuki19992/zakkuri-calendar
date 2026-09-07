import {
  parseTemporalDefinition,
  type TemporalDefinition,
  type TemporalGranularity,
  type TemporalResolverConfig,
} from './temporal-definition';

type SeedSpec = Readonly<{
  key: string;
  label: string;
  granularity: TemporalGranularity;
  resolverConfig: TemporalResolverConfig;
  fadeInRatio: number;
  fadeOutRatio: number;
}>;

const specs: readonly SeedSpec[] = [
  { key: 'morning', label: '朝', granularity: 'day', resolverConfig: { kind: 'timeOfDay', startMinute: 360, endMinute: 600 }, fadeInRatio: 0.25, fadeOutRatio: 0.25 },
  { key: 'am', label: '午前', granularity: 'day', resolverConfig: { kind: 'timeOfDay', startMinute: 480, endMinute: 720 }, fadeInRatio: 0, fadeOutRatio: 0 },
  { key: 'before_noon', label: '昼前', granularity: 'day', resolverConfig: { kind: 'timeOfDay', startMinute: 630, endMinute: 720 }, fadeInRatio: 0.35, fadeOutRatio: 0 },
  { key: 'around_noon', label: '昼ごろ', granularity: 'day', resolverConfig: { kind: 'timeOfDay', startMinute: 690, endMinute: 810 }, fadeInRatio: 0.5, fadeOutRatio: 0.5 },
  { key: 'early_afternoon', label: '昼過ぎ', granularity: 'day', resolverConfig: { kind: 'timeOfDay', startMinute: 780, endMinute: 960 }, fadeInRatio: 0, fadeOutRatio: 0.35 },
  { key: 'pm', label: '午後', granularity: 'day', resolverConfig: { kind: 'timeOfDay', startMinute: 720, endMinute: 1020 }, fadeInRatio: 0, fadeOutRatio: 0.35 },
  { key: 'evening', label: '夕方', granularity: 'day', resolverConfig: { kind: 'timeOfDay', startMinute: 960, endMinute: 1140 }, fadeInRatio: 0.25, fadeOutRatio: 0.25 },
  { key: 'night', label: '夜', granularity: 'day', resolverConfig: { kind: 'timeOfDay', startMinute: 1080, endMinute: 1380 }, fadeInRatio: 0.25, fadeOutRatio: 0.25 },
  { key: 'late_night', label: '深夜', granularity: 'day', resolverConfig: { kind: 'timeOfDay', startMinute: 1320, endMinute: 1560 }, fadeInRatio: 0.25, fadeOutRatio: 0.25 },
  { key: 'this_week_first_half', label: '今週前半', granularity: 'week', resolverConfig: { kind: 'week', selectionWeekOffset: 0, startWeekday: 1, endWeekday: 3 }, fadeInRatio: 0, fadeOutRatio: 0 },
  { key: 'this_week_second_half', label: '今週後半', granularity: 'week', resolverConfig: { kind: 'week', selectionWeekOffset: 0, startWeekday: 4, endWeekday: 5 }, fadeInRatio: 0, fadeOutRatio: 0 },
  { key: 'this_weekend', label: '今週末', granularity: 'week', resolverConfig: { kind: 'week', selectionWeekOffset: 0, startWeekday: 6, endWeekday: 7 }, fadeInRatio: 0, fadeOutRatio: 0 },
  { key: 'next_week', label: '来週', granularity: 'week', resolverConfig: { kind: 'week', selectionWeekOffset: 1, startWeekday: 1, endWeekday: 7 }, fadeInRatio: 0, fadeOutRatio: 0 },
  { key: 'next_week_first_half', label: '来週前半', granularity: 'week', resolverConfig: { kind: 'week', selectionWeekOffset: 1, startWeekday: 1, endWeekday: 3 }, fadeInRatio: 0, fadeOutRatio: 0 },
  { key: 'next_week_second_half', label: '来週後半', granularity: 'week', resolverConfig: { kind: 'week', selectionWeekOffset: 1, startWeekday: 4, endWeekday: 7 }, fadeInRatio: 0, fadeOutRatio: 0 },
  { key: 'week_after_next', label: '再来週', granularity: 'week', resolverConfig: { kind: 'week', selectionWeekOffset: 2, startWeekday: 1, endWeekday: 7 }, fadeInRatio: 0, fadeOutRatio: 0 },
  { key: 'month_start', label: '月初', granularity: 'month', resolverConfig: { kind: 'monthDays', selectionMonthOffset: 0, startDay: 1, endDay: 5 }, fadeInRatio: 0, fadeOutRatio: 0.35 },
  { key: 'month_first_third', label: '上旬', granularity: 'month', resolverConfig: { kind: 'monthDays', selectionMonthOffset: 0, startDay: 1, endDay: 10 }, fadeInRatio: 0, fadeOutRatio: 0 },
  { key: 'month_middle_third', label: '中旬', granularity: 'month', resolverConfig: { kind: 'monthDays', selectionMonthOffset: 0, startDay: 11, endDay: 20 }, fadeInRatio: 0, fadeOutRatio: 0 },
  { key: 'month_last_third', label: '下旬', granularity: 'month', resolverConfig: { kind: 'monthDays', selectionMonthOffset: 0, startDay: 21, endDay: 'last' }, fadeInRatio: 0, fadeOutRatio: 0 },
  { key: 'month_end', label: '月末', granularity: 'month', resolverConfig: { kind: 'monthLastDays', selectionMonthOffset: 0, count: 5 }, fadeInRatio: 0.35, fadeOutRatio: 0 },
  { key: 'next_month', label: '来月', granularity: 'month', resolverConfig: { kind: 'monthDays', selectionMonthOffset: 1, startDay: 1, endDay: 'last' }, fadeInRatio: 0, fadeOutRatio: 0 },
];

export function createStandardTemporalDefinitions(
  calendarId: string,
  now: string,
): TemporalDefinition[] {
  return specs.map((spec, index) => {
    const parsed = parseTemporalDefinition({
      id: `${calendarId}:${spec.key}`,
      calendarId,
      ...spec,
      isSystem: true,
      isEnabled: true,
      sortOrder: (index + 1) * 10,
      createdAt: now,
      updatedAt: now,
    });

    if (!parsed.ok) {
      throw new Error(`Invalid standard temporal definition: ${spec.key}`);
    }
    return parsed.value;
  });
}
