import type { EventOccurrence } from '@/domain/calendar/event-occurrence';
import { DEFAULT_EVENT_COLOR_ID, type EventColorId } from '@/constants/event-colors';
import { offsetCalendarDate, type TwoDayRange } from '@/domain/calendar/month';
import { resolveEventTime } from '@/domain/temporal/resolve-event-time';
import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';
import { getDay, parse } from 'date-fns';
import {
  createAgendaItems,
  getHolidayInfo,
  isResolvedRelativeEvent,
  occursOnCalendarDate,
  type HolidayRangeCoverage,
  type HolidaySupport,
} from './calendar-view-model';
import { createDayTimelineItems, type TimelineItemViewModel } from './timeline-layout';

const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土'] as const;

export type TwoDayViewModel = Readonly<{
  date: string;
  dateLabel: string;
  weekdayLabel: string;
  isToday: boolean;
  holidayName: string | null;
  holidaySupport: HolidaySupport;
  allDayItems: readonly TwoDayAllDayItemViewModel[];
  timelineItems: readonly TimelineItemViewModel[];
  accessibilityLabel: string;
}>;

export type TwoDayAllDayItemViewModel = Readonly<{
  kind: 'event' | 'fuzzyRange' | 'holiday';
  id: string;
  eventId: string | null;
  originalOccurrenceDate?: string;
  colorId: EventColorId | 'holiday';
  isInteractive: boolean;
  title: string;
  temporalLabel: string;
  rangePosition?: 'single' | 'start' | 'middle' | 'end';
  accessibilityLabel: string;
}>;

function getRangePosition(
  occurrence: EventOccurrence,
  date: string,
): 'single' | 'start' | 'middle' | 'end' {
  if (occurrence.occurrenceStartDate === occurrence.occurrenceThroughDate) return 'single';
  if (date === occurrence.occurrenceStartDate) return 'start';
  if (date === occurrence.occurrenceThroughDate) return 'end';
  return 'middle';
}

function getDateParts(date: string): readonly [number, number, number] {
  const [year, month, day] = date.split('-').map(Number);
  return [year, month, day];
}

function createDayViewModel(
  date: string,
  input: Readonly<{
    today: string;
    occurrences: readonly EventOccurrence[];
    definitions: ReadonlyMap<string, TemporalDefinition>;
    undeterminedFadeMinutes: number;
    calendarColorId: EventColorId;
    holidayCoverage: readonly HolidayRangeCoverage[];
  }>,
): TwoDayViewModel {
  const [year, month, day] = getDateParts(date);
  const weekdayLabel = weekdayLabels[getDay(parse(date, 'yyyy-MM-dd', new Date()))];
  const holiday = getHolidayInfo(date, input.holidayCoverage);
  const isToday = date === input.today;
  const definitionLabels = new Map(
    [...input.definitions.values()].map((definition) => [definition.id, definition.label] as const),
  );
  const occurrencesForDate = input.occurrences.filter((occurrence) =>
    occursOnCalendarDate(occurrence, date));
  const eventAllDayItems = createAgendaItems(
    occurrencesForDate.filter((occurrence) => {
      const event = occurrence.event;
      const definition = event.temporalType === 'fuzzy'
        ? input.definitions.get(event.temporalDefinitionId) ?? null
        : null;
      return resolveEventTime({
        event,
        definition,
        undeterminedFadeMinutes: input.undeterminedFadeMinutes,
      }).kind !== 'timed';
    }),
    definitionLabels,
  ).map((item): TwoDayAllDayItemViewModel => {
    const occurrence = occurrencesForDate.find((candidate) => candidate.key === item.id);
    const isFuzzyRange = occurrence !== undefined && isResolvedRelativeEvent(occurrence.event);
    const rangePosition = isFuzzyRange ? getRangePosition(occurrence, date) : null;
    const positionLabel = rangePosition === 'start'
      ? '期間の開始'
      : rangePosition === 'middle'
        ? '期間の途中'
        : rangePosition === 'end'
          ? '期間の終了'
          : rangePosition === 'single'
            ? '1日の期間'
            : null;
    return {
      ...item,
      kind: isFuzzyRange ? 'fuzzyRange' : 'event',
      eventId: item.eventId,
      colorId: occurrence?.event.colorId ?? input.calendarColorId,
      isInteractive: true,
      ...(rangePosition === null ? {} : { rangePosition }),
      accessibilityLabel: positionLabel === null
        ? item.accessibilityLabel
        : `${item.accessibilityLabel}、${positionLabel}`,
    };
  });
  const holidayItems: readonly TwoDayAllDayItemViewModel[] = holiday.name === null ? [] : [{
    kind: 'holiday',
    id: `holiday:${date}`,
    eventId: null,
    colorId: 'holiday',
    isInteractive: false,
    title: holiday.name,
    temporalLabel: '祝日',
    accessibilityLabel: `${holiday.name}、祝日`,
  }];
  const allDayItems = [...holidayItems, ...eventAllDayItems];
  const timelineItems = createDayTimelineItems({
    date,
    occurrences: input.occurrences,
    definitions: input.definitions,
    undeterminedFadeMinutes: input.undeterminedFadeMinutes,
    calendarColorId: input.calendarColorId,
  });
  const itemCount = new Set([...eventAllDayItems, ...timelineItems].map((item) => item.id)).size;
  const labels = [`${year}年${month}月${day}日`, `${weekdayLabel}曜日`];
  if (holiday.name !== null) labels.push(holiday.name);
  if (holiday.support === 'unsupported') labels.push('祝日情報未対応');
  if (isToday) labels.push('今日');
  labels.push(itemCount === 0 ? '予定なし' : `予定${itemCount}件`);

  return {
    date,
    dateLabel: `${month}月${day}日`,
    weekdayLabel,
    isToday,
    holidayName: holiday.name,
    holidaySupport: holiday.support,
    allDayItems,
    timelineItems,
    accessibilityLabel: labels.join('、'),
  };
}

export function createTwoDayViewModels(input: Readonly<{
  range: TwoDayRange;
  today: string;
  occurrences: readonly EventOccurrence[];
  definitions: ReadonlyMap<string, TemporalDefinition>;
  undeterminedFadeMinutes: number;
  calendarColorId?: EventColorId;
  holidayCoverage: readonly HolidayRangeCoverage[];
}>): readonly [TwoDayViewModel, TwoDayViewModel] {
  const inputWithColor = { ...input, calendarColorId: input.calendarColorId ?? DEFAULT_EVENT_COLOR_ID };
  return [createDayViewModel(input.range.from, inputWithColor), createDayViewModel(input.range.through, inputWithColor)];
}

/**
 * 2日ビューの横スワイプを、取得済みの予備列でジャンプなく連続スライドさせるための
 * 既定予備日数。前後にこの日数分の列をあらかじめ取得・描画しておく。
 * 値を変える場合は{@link createTwoDayStripDates}・{@link createTwoDayStripViewModels}
 * を使う箇所すべてに反映される。
 */
export const TWO_DAY_SWIPE_BUFFER_DAYS = 1;

/**
 * 表示する2日の前後に、スワイプ用の予備日を`bufferDays`日分ずつ加えた日付の並びを返す。
 * `bufferDays`が0の場合は表示する2日だけを返す。
 */
export function createTwoDayStripDates(range: TwoDayRange, bufferDays: number): readonly string[] {
  const before = Array.from({ length: bufferDays }, (_, index) =>
    offsetCalendarDate(range.from, index - bufferDays));
  const after = Array.from({ length: bufferDays }, (_, index) =>
    offsetCalendarDate(range.through, index + 1));
  return [...before, range.from, range.through, ...after];
}

/**
 * スワイプ用の予備列も含めた各日の表示用モデルを作る。
 * 配列の並びは{@link createTwoDayStripDates}と同じ(予備列→表示2日→予備列)。
 */
export function createTwoDayStripViewModels(input: Readonly<{
  range: TwoDayRange;
  bufferDays: number;
  today: string;
  occurrences: readonly EventOccurrence[];
  definitions: ReadonlyMap<string, TemporalDefinition>;
  undeterminedFadeMinutes: number;
  calendarColorId?: EventColorId;
  holidayCoverage: readonly HolidayRangeCoverage[];
}>): readonly TwoDayViewModel[] {
  const inputWithColor = { ...input, calendarColorId: input.calendarColorId ?? DEFAULT_EVENT_COLOR_ID };
  return createTwoDayStripDates(input.range, input.bufferDays)
    .map((date) => createDayViewModel(date, inputWithColor));
}
