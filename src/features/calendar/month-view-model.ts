import type { EventOccurrence } from '@/domain/calendar/event-occurrence';
import type { EventColorId } from '@/constants/event-colors';
import type { MonthGridDate } from '@/domain/calendar/month';
import {
  getHolidayInfo,
  isResolvedRelativeEvent,
  occursOnCalendarDate,
  type HolidayRangeCoverage,
  type HolidaySupport,
} from './calendar-view-model';

export {
  createAgendaItems,
  type AgendaItemViewModel,
  type HolidayRangeCoverage,
} from './calendar-view-model';

export type MonthDayViewModel = Readonly<{
  date: string;
  dayNumber: number;
  weekday: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  hasEvents: boolean;
  hasFixedEvents?: boolean;
  hasFuzzyRangeEvents?: boolean;
  holidaySupport: HolidaySupport;
  holidayName: string | null;
  accessibilityLabel: string;
}>;

export type MonthEventSegmentViewModel = Readonly<{
  id: string;
  eventId: string;
  originalOccurrenceDate?: string;
  weekIndex: number;
  lane: number;
  startWeekday: number;
  spanDays: number;
  position: 'start' | 'middle' | 'end' | 'single';
  startsInWeek: boolean;
  endsInWeek: boolean;
  continuesFromPreviousWeek: boolean;
  continuesToNextWeek: boolean;
  colorId: EventColorId;
  title: string;
  temporalLabel: string;
  accessibilityLabel: string;
}>;

export type MonthWeekViewModel = Readonly<{
  days: readonly (MonthGridDate & Readonly<{ hiddenEventCount: number }>)[];
  segments: readonly MonthEventSegmentViewModel[];
}>;

function getOccurrenceTemporalLabel(occurrence: EventOccurrence, labels: ReadonlyMap<string, string>): string {
  const { event } = occurrence;
  if (event.temporalType === 'exact') return event.startTime;
  if (event.temporalType === 'allDay') return '終日';
  return labels.get(event.temporalDefinitionId) ?? 'ざっくり';
}

function getSegmentPriority(occurrence: EventOccurrence): number {
  if (occurrence.occurrenceStartDate < occurrence.occurrenceThroughDate) return 0;
  return occurrence.event.temporalType === 'allDay' ? 1 : 2;
}

export function createMonthWeekViewModels(input: Readonly<{
  grid: readonly MonthGridDate[];
  occurrences: readonly EventOccurrence[];
  definitionLabels: ReadonlyMap<string, string>;
  calendarColorId: EventColorId;
}>): readonly MonthWeekViewModel[] {
  return Array.from({ length: Math.ceil(input.grid.length / 7) }, (_, weekIndex) => {
    const days = input.grid.slice(weekIndex * 7, weekIndex * 7 + 7);
    const from = days[0]?.date;
    const through = days.at(-1)?.date;
    if (from === undefined || through === undefined) return { days: [], segments: [] };
    const hiddenEventCount = new Map(days.map((day) => [day.date, 0]));
    const candidates = input.occurrences
      .filter((occurrence) => occurrence.occurrenceStartDate <= through && occurrence.occurrenceThroughDate >= from)
      .sort((first, second) =>
        getSegmentPriority(first) - getSegmentPriority(second)
        || (first.occurrenceStartDate < from ? from : first.occurrenceStartDate)
          .localeCompare(second.occurrenceStartDate < from ? from : second.occurrenceStartDate)
        || getOccurrenceTemporalLabel(first, input.definitionLabels).localeCompare(getOccurrenceTemporalLabel(second, input.definitionLabels))
        || first.key.localeCompare(second.key));
    const laneEnds = Array.from({ length: 3 }, () => '');
    const segments: MonthEventSegmentViewModel[] = [];
    for (const occurrence of candidates) {
      const segmentFrom = occurrence.occurrenceStartDate < from ? from : occurrence.occurrenceStartDate;
      const segmentThrough = occurrence.occurrenceThroughDate > through ? through : occurrence.occurrenceThroughDate;
      const startWeekday = days.findIndex((day) => day.date === segmentFrom);
      const endWeekday = days.findIndex((day) => day.date === segmentThrough);
      const lane = laneEnds.findIndex((end) => end < segmentFrom);
      if (lane < 0) {
        days.filter((day) => day.date >= segmentFrom && day.date <= segmentThrough)
          .forEach((day) => hiddenEventCount.set(day.date, (hiddenEventCount.get(day.date) ?? 0) + 1));
        continue;
      }
      laneEnds[lane] = segmentThrough;
      const continuesFromPreviousWeek = occurrence.occurrenceStartDate < from;
      const continuesToNextWeek = occurrence.occurrenceThroughDate > through;
      const startsInWeek = !continuesFromPreviousWeek;
      const endsInWeek = !continuesToNextWeek;
      const position = continuesFromPreviousWeek
        ? continuesToNextWeek ? 'middle' : 'end'
        : continuesToNextWeek ? 'start' : startWeekday === endWeekday ? 'single' : 'start';
      const eventId = occurrence.occurrenceIdentity?.seriesEventId ?? occurrence.eventId;
      const temporalLabel = getOccurrenceTemporalLabel(occurrence, input.definitionLabels);
      segments.push({
        id: occurrence.key,
        eventId,
        ...(occurrence.occurrenceIdentity === null ? {} : { originalOccurrenceDate: occurrence.occurrenceIdentity.originalOccurrenceDate }),
        weekIndex,
        lane,
        startWeekday,
        spanDays: endWeekday - startWeekday + 1,
        position,
        startsInWeek,
        endsInWeek,
        continuesFromPreviousWeek,
        continuesToNextWeek,
        colorId: occurrence.event.colorId ?? input.calendarColorId,
        title: occurrence.event.title,
        temporalLabel,
        accessibilityLabel: [occurrence.event.title, temporalLabel, occurrence.occurrenceStartDate < occurrence.occurrenceThroughDate ? '複数日にまたがる予定' : null, occurrence.isRecurring ? '繰り返し予定' : null].filter((value): value is string => value !== null).join('、'),
      });
    }
    return {
      days: days.map((day) => ({ ...day, hiddenEventCount: hiddenEventCount.get(day.date) ?? 0 })),
      segments,
    };
  });
}

function formatJapaneseDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return `${year}年${month}月${day}日`;
}

function createAccessibilityLabel(
  date: string,
  holidayName: string | null,
  holidaySupport: 'available' | 'unsupported',
  isToday: boolean,
  isSelected: boolean,
  hasEvents: boolean,
  relativeEventLabels: readonly string[],
): string {
  const labels = [formatJapaneseDate(date)];
  if (holidayName !== null) labels.push(holidayName);
  if (holidaySupport === 'unsupported') labels.push('祝日情報未対応');
  if (isToday) labels.push('今日');
  if (isSelected) labels.push('選択中');
  if (hasEvents) labels.push('予定あり');
  labels.push(...relativeEventLabels);
  return labels.join('、');
}

export function createMonthDayViewModels(input: Readonly<{
  grid: readonly MonthGridDate[];
  selectedDate: string;
  today: string;
  occurrences: readonly EventOccurrence[];
  holidayCoverage: readonly HolidayRangeCoverage[];
  definitionLabels?: ReadonlyMap<string, string>;
}>): readonly MonthDayViewModel[] {
  return input.grid.map((gridDate) => {
    const isToday = gridDate.date === input.today;
    const isSelected = gridDate.date === input.selectedDate;
    const occurrencesForDate = input.occurrences.filter((occurrence) =>
      occursOnCalendarDate(occurrence, gridDate.date));
    const hasFuzzyRangeEvents = occurrencesForDate.some((occurrence) =>
      isResolvedRelativeEvent(occurrence.event));
    const hasFixedEvents = occurrencesForDate.some((occurrence) =>
      !isResolvedRelativeEvent(occurrence.event));
    const hasEvents = occurrencesForDate.length > 0;
    const relativeEventCounts = new Map<string, number>();
    for (const occurrence of occurrencesForDate) {
      if (!isResolvedRelativeEvent(occurrence.event) || occurrence.event.temporalType !== 'fuzzy') continue;
      const label = input.definitionLabels?.get(occurrence.event.temporalDefinitionId) ?? 'ざっくり予定';
      relativeEventCounts.set(label, (relativeEventCounts.get(label) ?? 0) + 1);
    }
    const relativeEventLabels = [...relativeEventCounts].map(([label, count]) => `${label}${count}件`);
    const holiday = getHolidayInfo(gridDate.date, input.holidayCoverage);

    return {
      ...gridDate,
      isToday,
      isSelected,
      hasEvents,
      ...(hasFuzzyRangeEvents ? { hasFixedEvents, hasFuzzyRangeEvents } : {}),
      holidaySupport: holiday.support,
      holidayName: holiday.name,
      accessibilityLabel: createAccessibilityLabel(
        gridDate.date,
        holiday.name,
        holiday.support,
        isToday,
        isSelected,
        hasEvents,
        relativeEventLabels,
      ),
    };
  });
}
