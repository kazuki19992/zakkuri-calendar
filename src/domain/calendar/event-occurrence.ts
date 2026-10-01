import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  differenceInCalendarWeeks,
  differenceInCalendarYears,
  format,
  getDay,
  parse,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';
import type { Result } from '@/domain/shared/result';
import type { CalendarEvent } from './event';
import { isCalendarDate } from './month';
import {
  materializeOccurrenceReplacement,
  type CalendarScheduleSnapshot,
  type OccurrenceIdentity,
  type RecurrenceException,
} from './recurrence-exception';
import type { RecurrenceRuleV1 } from './recurrence';
import { toMinutesOfDay } from './time';

const CALENDAR_DATE_FORMAT = 'yyyy-MM-dd';
const MINUTES_PER_DAY = 24 * 60;

export type EventOccurrence = Readonly<{
  key: string;
  eventId: string;
  occurrenceIdentity: OccurrenceIdentity | null;
  occurrenceStartDate: string;
  occurrenceThroughDate: string;
  isRecurring: boolean;
  event: CalendarEvent;
}>;

export type EventOccurrenceExpansionError = Readonly<{
  field: string;
  message: string;
}>;

type DateParts = Readonly<{
  day: number;
  monthDay: string;
}>;

function fail(
  field: string,
  message: string,
): Result<never, EventOccurrenceExpansionError> {
  return { ok: false, error: { field, message } };
}

function parseCalendarDate(value: string): Date {
  return parse(value, CALENDAR_DATE_FORMAT, new Date());
}

function toCalendarDate(value: Date): string {
  return format(value, CALENDAR_DATE_FORMAT);
}

function addCalendarDays(value: string, days: number): string {
  return toCalendarDate(addDays(parseCalendarDate(value), days));
}

function getOccurrenceSpanDays(event: CalendarEvent): number {
  if (event.temporalType === 'allDay' || event.temporalType === 'fuzzy') {
    return differenceInCalendarDays(
      parseCalendarDate(event.endDate),
      parseCalendarDate(event.anchorDate),
    );
  }
  if (event.temporalType === 'exact' && event.duration.type === 'fixed') {
    const startMinute = toMinutesOfDay(event.startTime);
    return Math.floor(((startMinute ?? 0) + event.duration.minutes - 1) / MINUTES_PER_DAY);
  }
  return 0;
}

function createOccurrence(
  event: CalendarEvent,
  startDate: string,
  isRecurring: boolean,
  occurrenceIdentity: OccurrenceIdentity | null = isRecurring
    ? { seriesEventId: event.id, originalOccurrenceDate: startDate }
    : null,
): EventOccurrence {
  return {
    key: isRecurring ? `${event.id}:recurrence:${startDate}` : event.id,
    eventId: event.id,
    occurrenceIdentity,
    occurrenceStartDate: startDate,
    occurrenceThroughDate: addCalendarDays(startDate, getOccurrenceSpanDays(event)),
    isRecurring,
    event,
  };
}

function intersectsRange(
  occurrence: EventOccurrence,
  from: string,
  through: string,
): boolean {
  return occurrence.occurrenceStartDate <= through && occurrence.occurrenceThroughDate >= from;
}

function isPastEnd(
  rule: RecurrenceRuleV1,
  date: string,
  occurrenceIndex: number,
): boolean {
  if (rule.end.type === 'until') return date > rule.end.date;
  if (rule.end.type === 'count') return occurrenceIndex >= rule.end.count;
  return false;
}

function expandDaily(
  event: CalendarEvent,
  searchFrom: string,
  through: string,
): readonly EventOccurrence[] {
  const rule = event.recurrenceRule;
  if (rule === null) return [];
  const dayDifference = differenceInCalendarDays(
    parseCalendarDate(searchFrom),
    parseCalendarDate(event.anchorDate),
  );
  const firstIndex = Math.max(0, Math.ceil(dayDifference / rule.interval));
  const occurrences: EventOccurrence[] = [];

  for (let index = firstIndex; ; index += 1) {
    const date = addCalendarDays(event.anchorDate, index * rule.interval);
    if (date > through || isPastEnd(rule, date, index)) break;
    if (date >= searchFrom) occurrences.push(createOccurrence(event, date, true));
  }
  return occurrences;
}

function weekdayOffsetFromMonday(weekday: number): number {
  return weekday === 0 ? 6 : weekday - 1;
}

function expandWeekly(
  event: CalendarEvent,
  searchFrom: string,
  through: string,
): readonly EventOccurrence[] {
  const rule = event.recurrenceRule;
  if (rule === null || rule.weekdays.length === 0) return [];

  const anchorDate = parseCalendarDate(event.anchorDate);
  const anchorWeek = startOfWeek(anchorDate, { weekStartsOn: 1 });
  const searchWeek = startOfWeek(parseCalendarDate(searchFrom), { weekStartsOn: 1 });
  const weekDifference = differenceInCalendarWeeks(searchWeek, anchorWeek, { weekStartsOn: 1 });
  const firstWeekOrdinal = Math.max(0, Math.ceil(weekDifference / rule.interval));
  const weekdayOffsets = rule.weekdays
    .map(weekdayOffsetFromMonday)
    .sort((left, right) => left - right);
  const anchorWeekdayOffset = weekdayOffsetFromMonday(getDay(anchorDate));
  const firstWeekCount = weekdayOffsets
    .filter((weekdayOffset) => weekdayOffset >= anchorWeekdayOffset).length;
  let occurrenceIndex = firstWeekOrdinal === 0
    ? 0
    : firstWeekCount + (firstWeekOrdinal - 1) * weekdayOffsets.length;
  const occurrences: EventOccurrence[] = [];

  for (let weekOrdinal = firstWeekOrdinal; ; weekOrdinal += 1) {
    const week = addWeeks(anchorWeek, weekOrdinal * rule.interval);
    if (toCalendarDate(week) > through) break;

    for (const weekdayOffset of weekdayOffsets) {
      const date = toCalendarDate(addDays(week, weekdayOffset));
      if (date < event.anchorDate) continue;
      if (isPastEnd(rule, date, occurrenceIndex)) return occurrences;
      if (date > through) return occurrences;
      if (date >= searchFrom) occurrences.push(createOccurrence(event, date, true));
      occurrenceIndex += 1;
    }
  }
  return occurrences;
}

function getDateParts(anchorDate: string): DateParts {
  const [, month, day] = anchorDate.split('-');
  return { day: Number(day), monthDay: `${month}-${day}` };
}

function candidateForMonth(anchor: DateParts, month: string): string | null {
  const value = `${month}-${String(anchor.day).padStart(2, '0')}`;
  return isCalendarDate(value) ? value : null;
}

function candidateForYear(anchor: DateParts, year: number): string | null {
  const value = `${String(year).padStart(4, '0')}-${anchor.monthDay}`;
  return isCalendarDate(value) ? value : null;
}

function expandMonthly(
  event: CalendarEvent,
  searchFrom: string,
  through: string,
): readonly EventOccurrence[] {
  const rule = event.recurrenceRule;
  if (rule === null) return [];
  const anchorDate = parseCalendarDate(event.anchorDate);
  const anchorMonth = startOfMonth(anchorDate);
  const monthDifference = differenceInCalendarMonths(
    startOfMonth(parseCalendarDate(searchFrom)),
    anchorMonth,
  );
  const firstMonthOrdinal = Math.max(0, Math.ceil(monthDifference / rule.interval));
  const anchorParts = getDateParts(event.anchorDate);
  let occurrenceIndex = 0;

  for (let ordinal = 0; ordinal < firstMonthOrdinal; ordinal += 1) {
    const month = format(addMonths(anchorMonth, ordinal * rule.interval), 'yyyy-MM');
    if (candidateForMonth(anchorParts, month) !== null) occurrenceIndex += 1;
  }

  const occurrences: EventOccurrence[] = [];
  for (let ordinal = firstMonthOrdinal; ; ordinal += 1) {
    const monthDate = addMonths(anchorMonth, ordinal * rule.interval);
    if (toCalendarDate(monthDate) > through) break;
    const date = candidateForMonth(anchorParts, format(monthDate, 'yyyy-MM'));
    if (date === null) continue;
    if (isPastEnd(rule, date, occurrenceIndex)) break;
    if (date > through) break;
    if (date >= searchFrom) occurrences.push(createOccurrence(event, date, true));
    occurrenceIndex += 1;
  }
  return occurrences;
}

function expandYearly(
  event: CalendarEvent,
  searchFrom: string,
  through: string,
): readonly EventOccurrence[] {
  const rule = event.recurrenceRule;
  if (rule === null) return [];
  const anchorDate = parseCalendarDate(event.anchorDate);
  const anchorYear = startOfYear(anchorDate);
  const yearDifference = differenceInCalendarYears(
    startOfYear(parseCalendarDate(searchFrom)),
    anchorYear,
  );
  const firstYearOrdinal = Math.max(0, Math.ceil(yearDifference / rule.interval));
  const anchorParts = getDateParts(event.anchorDate);
  let occurrenceIndex = 0;

  for (let ordinal = 0; ordinal < firstYearOrdinal; ordinal += 1) {
    const year = addYears(anchorYear, ordinal * rule.interval).getFullYear();
    if (candidateForYear(anchorParts, year) !== null) occurrenceIndex += 1;
  }

  const occurrences: EventOccurrence[] = [];
  for (let ordinal = firstYearOrdinal; ; ordinal += 1) {
    const yearDate = addYears(anchorYear, ordinal * rule.interval);
    if (toCalendarDate(yearDate) > through) break;
    const date = candidateForYear(anchorParts, yearDate.getFullYear());
    if (date === null) continue;
    if (isPastEnd(rule, date, occurrenceIndex)) break;
    if (date > through) break;
    if (date >= searchFrom) occurrences.push(createOccurrence(event, date, true));
    occurrenceIndex += 1;
  }
  return occurrences;
}

function expandRecurringEvent(
  event: CalendarEvent,
  from: string,
  through: string,
): readonly EventOccurrence[] {
  const rule = event.recurrenceRule;
  if (rule === null) return [];
  const searchFrom = addCalendarDays(from, -getOccurrenceSpanDays(event));
  const occurrences = rule.frequency === 'daily'
    ? expandDaily(event, searchFrom, through)
    : rule.frequency === 'weekly'
      ? expandWeekly(event, searchFrom, through)
      : rule.frequency === 'monthly'
        ? expandMonthly(event, searchFrom, through)
        : expandYearly(event, searchFrom, through);
  return occurrences.filter((occurrence) => intersectsRange(occurrence, from, through));
}

type EventOccurrenceExpansionInput = Readonly<{
  from: string;
  through: string;
}> & (
  | Readonly<{ events: readonly CalendarEvent[]; snapshot?: never }>
  | Readonly<{ snapshot: CalendarScheduleSnapshot; events?: never }>
);

function exceptionKey(identity: OccurrenceIdentity): string {
  return `${identity.seriesEventId}\u0000${identity.originalOccurrenceDate}`;
}

function getSeriesExpansionRange(
  event: CalendarEvent,
  exceptions: readonly RecurrenceException[],
  from: string,
  through: string,
): Readonly<{ from: string; through: string }> {
  const dates = exceptions
    .filter((exception) => exception.seriesEventId === event.id)
    .map((exception) => exception.originalOccurrenceDate);
  return {
    from: dates.reduce((minimum, date) => date < minimum ? date : minimum, from),
    through: dates.reduce((maximum, date) => date > maximum ? date : maximum, through),
  };
}

export function expandEventOccurrences(
  input: EventOccurrenceExpansionInput,
): Result<readonly EventOccurrence[], EventOccurrenceExpansionError> {
  if (!isCalendarDate(input.from)) return fail('from', 'from must be a real calendar date');
  if (!isCalendarDate(input.through)) return fail('through', 'through must be a real calendar date');
  if (input.from > input.through) return fail('range', 'from must not be after through');

  const snapshot = 'snapshot' in input && input.snapshot !== undefined
    ? input.snapshot
    : { events: input.events, exceptions: [], replacementEvents: [] };
  const replacementById = new Map(snapshot.replacementEvents.map((event) => [event.id, event]));
  const exceptionByIdentity = new Map(
    snapshot.exceptions.map((exception) => [exceptionKey(exception), exception]),
  );
  if (snapshot.exceptions.some((exception) =>
    exception.kind === 'replaced' && !replacementById.has(exception.replacementEventId ?? ''))) {
    return fail('exceptions', 'replacement event must exist');
  }

  const sourceOccurrences = snapshot.events.flatMap((event) => {
    if (event.recurrenceRule !== null) {
      const range = getSeriesExpansionRange(event, snapshot.exceptions, input.from, input.through);
      return expandRecurringEvent(event, range.from, range.through);
    }
    const occurrence = createOccurrence(event, event.anchorDate, false);
    return intersectsRange(occurrence, input.from, input.through) ? [occurrence] : [];
  });

  const occurrences = sourceOccurrences.flatMap((occurrence): readonly EventOccurrence[] => {
    if (occurrence.occurrenceIdentity === null) return [occurrence];
    const exception = exceptionByIdentity.get(exceptionKey(occurrence.occurrenceIdentity));
    if (exception === undefined) return [occurrence];
    if (exception.kind === 'deleted') return [];
    const replacementEvent = replacementById.get(exception.replacementEventId ?? '');
    if (replacementEvent === undefined) return [];
    const event = materializeOccurrenceReplacement({
      seriesEvent: occurrence.event,
      replacementEvent,
      overrideFields: exception.overrideFields,
      occurrenceDate: occurrence.occurrenceIdentity.originalOccurrenceDate,
    });
    const replacementOccurrence = createOccurrence(
      event,
      event.anchorDate,
      true,
      occurrence.occurrenceIdentity,
    );
    return [{
      ...replacementOccurrence,
      key: `${occurrence.key}:replacement`,
    }];
  }).filter((occurrence) => intersectsRange(occurrence, input.from, input.through));

  occurrences.sort((left, right) =>
    left.occurrenceStartDate.localeCompare(right.occurrenceStartDate)
    || left.event.createdAt.localeCompare(right.event.createdAt)
    || left.eventId.localeCompare(right.eventId)
    || left.key.localeCompare(right.key));
  return { ok: true, value: occurrences };
}
