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
import { createDateRangeOpacityStops, type DateRangeOpacityStop } from './date-range-gradient';

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

export type TwoDayAllDaySegmentViewModel = Readonly<{
  id: string;
  item: TwoDayAllDayItemViewModel;
  startIndex: number;
  spanDays: number;
  lane: number;
  isFuzzyRange: boolean;
  opacityStops: readonly DateRangeOpacityStop[];
  startsAtRangeStart: boolean;
  endsAtRangeEnd: boolean;
}>;

export type TwoDayAllDayLayout = Readonly<{
  segments: readonly TwoDayAllDaySegmentViewModel[];
  hiddenCounts: readonly number[];
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
  rangeStartDate?: string;
  rangeThroughDate?: string;
  fadeInRatio?: number;
  fadeOutRatio?: number;
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
    const definition = isFuzzyRange && occurrence.event.temporalType === 'fuzzy'
      ? input.definitions.get(occurrence.event.temporalDefinitionId)
      : undefined;
    const rangePosition = occurrence !== undefined
      && occurrence.occurrenceStartDate < occurrence.occurrenceThroughDate
      ? getRangePosition(occurrence, date)
      : null;
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
      ...(isFuzzyRange && occurrence !== undefined ? {
        rangeStartDate: occurrence.occurrenceStartDate,
        rangeThroughDate: occurrence.occurrenceThroughDate,
        fadeInRatio: definition?.fadeInRatio ?? 0,
        fadeOutRatio: definition?.fadeOutRatio ?? 0,
      } : {}),
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

const ALL_DAY_LANE_LIMIT = 2;

/** 予備列を含む日付列を横断して、同じ予定を一本の帯へまとめる。 */
export function createTwoDayAllDayLayout(strip: readonly TwoDayViewModel[]): TwoDayAllDayLayout {
  const candidates: { item: TwoDayAllDayItemViewModel; startIndex: number; endIndex: number }[] = [];
  const consumed = new Set<string>();
  strip.forEach((day, dayIndex) => day.allDayItems.forEach((item) => {
    if (consumed.has(item.id)) return;
    consumed.add(item.id);
    let endIndex = dayIndex;
    while (endIndex + 1 < strip.length && strip[endIndex + 1].allDayItems.some((candidate) => candidate.id === item.id)) {
      endIndex += 1;
    }
    candidates.push({ item, startIndex: dayIndex, endIndex });
  }));
  candidates.sort((a, b) => {
    const aSpan = a.endIndex - a.startIndex;
    const bSpan = b.endIndex - b.startIndex;
    return bSpan - aSpan
      || (a.item.kind === 'holiday' ? 0 : 1) - (b.item.kind === 'holiday' ? 0 : 1)
      || a.startIndex - b.startIndex
      || a.item.id.localeCompare(b.item.id);
  });

  const laneOccupancies: { startIndex: number; endIndex: number }[][] = Array.from(
    { length: ALL_DAY_LANE_LIMIT },
    () => [],
  );
  const hiddenCounts = Array.from({ length: strip.length }, () => 0);
  const segments: TwoDayAllDaySegmentViewModel[] = [];
  for (const candidate of candidates) {
    const lane = laneOccupancies.findIndex((occupancies) => occupancies.every((occupied) =>
      occupied.endIndex < candidate.startIndex || candidate.endIndex < occupied.startIndex));
    if (lane < 0) {
      for (let index = candidate.startIndex; index <= candidate.endIndex; index += 1) hiddenCounts[index] += 1;
      continue;
    }
    laneOccupancies[lane].push({ startIndex: candidate.startIndex, endIndex: candidate.endIndex });
    const clipStartDate = strip[candidate.startIndex].date;
    const clipThroughDate = strip[candidate.endIndex].date;
    const isFuzzyRange = candidate.item.kind === 'fuzzyRange';
    const rangeStartDate = candidate.item.rangeStartDate;
    const rangeThroughDate = candidate.item.rangeThroughDate;
    const hasGradientRange = rangeStartDate !== undefined && rangeThroughDate !== undefined;
    const lastItem = strip[candidate.endIndex].allDayItems.find((item) => item.id === candidate.item.id);
    segments.push({
      id: candidate.item.id,
      item: candidate.item,
      startIndex: candidate.startIndex,
      spanDays: candidate.endIndex - candidate.startIndex + 1,
      lane,
      isFuzzyRange,
      startsAtRangeStart: candidate.item.rangePosition !== 'middle' && candidate.item.rangePosition !== 'end',
      endsAtRangeEnd: lastItem?.rangePosition !== 'middle' && lastItem?.rangePosition !== 'start',
      opacityStops: hasGradientRange
        ? createDateRangeOpacityStops({
          rangeStartDate: rangeStartDate ?? clipStartDate,
          rangeThroughDate: rangeThroughDate ?? clipThroughDate,
          clipStartDate,
          clipThroughDate,
          fadeInRatio: candidate.item.fadeInRatio ?? 0,
          fadeOutRatio: candidate.item.fadeOutRatio ?? 0,
        })
        : [{ offset: 0, opacity: 1 }, { offset: 1, opacity: 1 }],
    });
  }
  return { segments, hiddenCounts };
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
