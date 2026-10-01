import { addDays, addYears, differenceInCalendarDays, format, parse } from 'date-fns';
import type { CalendarEvent } from './event';
import { expandEventOccurrences } from './event-occurrence';
import type { EventAggregate } from './event-reminder';
import type {
  EventOverrideField,
  OccurrenceIdentity,
  RecurrenceException,
} from './recurrence-exception';
import { materializeOccurrenceReplacement } from './recurrence-exception';
import type { RecurrenceRuleV1 } from './recurrence';

const DATE_FORMAT = 'yyyy-MM-dd';

export type ChangedEventField = EventOverrideField | 'recurrence';
export type RecurrenceMutationScope = 'occurrence' | 'following' | 'series';

export type RecurrenceMutationPlan = Readonly<{
  removePreviousSeries: boolean;
  previousSeries: EventAggregate | null;
  nextSeries: EventAggregate | null;
  upsertExceptions: readonly RecurrenceException[];
  deleteExceptionIdentities: readonly OccurrenceIdentity[];
  deleteReplacementEventIds: readonly string[];
}>;

type PlanFollowingMutationInput = Readonly<{
  series: EventAggregate;
  boundaryDate: string;
  submitted: EventAggregate;
  exceptions: readonly RecurrenceException[];
  createSeriesId(): string;
  now: string;
}>;

type PlanSeriesMutationInput = Readonly<{
  series: EventAggregate;
  boundaryDate: string;
  submitted: EventAggregate;
  exceptions: readonly RecurrenceException[];
  now: string;
}>;

function jsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function temporalValue(event: CalendarEvent): unknown {
  if (event.temporalType === 'exact') {
    return { type: event.temporalType, anchorDate: event.anchorDate,
      startTime: event.startTime, duration: event.duration,
      createdTimeZoneId: event.createdTimeZoneId };
  }
  if (event.temporalType === 'allDay') {
    return { type: event.temporalType, anchorDate: event.anchorDate,
      endDate: event.endDate, createdTimeZoneId: event.createdTimeZoneId };
  }
  return { type: event.temporalType, anchorDate: event.anchorDate,
    endDate: event.endDate, temporalDefinitionId: event.temporalDefinitionId,
    resolutionContext: event.resolutionContext, createdTimeZoneId: event.createdTimeZoneId };
}

export function getChangedEventFields(
  before: EventAggregate,
  after: EventAggregate,
): readonly ChangedEventField[] {
  const changed: ChangedEventField[] = [];
  if (before.event.title !== after.event.title) changed.push('title');
  if (!jsonEqual(temporalValue(before.event), temporalValue(after.event))) changed.push('temporal');
  if (before.event.location !== after.event.location) changed.push('location');
  if (before.event.notes !== after.event.notes) changed.push('notes');
  if (before.event.colorId !== after.event.colorId) changed.push('color');
  if (!jsonEqual(before.reminders.map(({ minutesBefore }) => minutesBefore),
    after.reminders.map(({ minutesBefore }) => minutesBefore))) changed.push('reminders');
  if (!jsonEqual(before.event.recurrenceRule, after.event.recurrenceRule)) changed.push('recurrence');
  return changed;
}

export function buildSeriesScopedAggregate(input: Readonly<{
  series: EventAggregate;
  occurrenceDate: string;
  displayed: EventAggregate;
  submitted: EventAggregate;
}>): EventAggregate {
  const changed = new Set(getChangedEventFields(input.displayed, input.submitted));
  const overrideFields = [...changed]
    .filter((field): field is EventOverrideField => field !== 'recurrence');
  const event = materializeOccurrenceReplacement({
    seriesEvent: input.series.event,
    replacementEvent: input.submitted.event,
    overrideFields,
    occurrenceDate: input.occurrenceDate,
  });
  return {
    event: {
      ...event,
      id: input.series.event.id,
      recurrenceRule: changed.has('recurrence')
        ? input.submitted.event.recurrenceRule
        : input.series.event.recurrenceRule,
      createdAt: input.series.event.createdAt,
      updatedAt: input.submitted.event.updatedAt,
    },
    reminders: changed.has('reminders') ? input.submitted.reminders : input.series.reminders,
  };
}

function offsetDate(value: string, days: number): string {
  return format(addDays(parse(value, DATE_FORMAT, new Date()), days), DATE_FORMAT);
}

function occurrenceCountBefore(series: CalendarEvent, boundaryDate: string): number {
  const result = expandEventOccurrences({
    events: [series],
    from: series.anchorDate,
    through: boundaryDate,
  });
  if (!result.ok) throw new Error('Invalid recurrence split range');
  const before = result.value.filter((occurrence) =>
    occurrence.occurrenceStartDate < boundaryDate).length;
  const hasBoundary = result.value.some((occurrence) =>
    occurrence.occurrenceStartDate === boundaryDate);
  if (!hasBoundary) throw new Error('Recurrence split boundary must be an occurrence');
  return before;
}

function previousRule(rule: RecurrenceRuleV1, countBefore: number, boundaryDate: string): RecurrenceRuleV1 {
  return {
    ...rule,
    end: rule.end.type === 'count'
      ? { type: 'count', count: countBefore }
      : { type: 'until', date: offsetDate(boundaryDate, -1) },
  };
}

function nextRule(
  original: RecurrenceRuleV1,
  submitted: RecurrenceRuleV1 | null,
  countBefore: number,
  dayOffset: number,
): RecurrenceRuleV1 | null {
  if (submitted === null) return null;
  if (!jsonEqual(original, submitted)) return submitted;
  if (original.end.type === 'count') {
    return { ...submitted, end: { type: 'count', count: original.end.count - countBefore } };
  }
  if (original.end.type === 'until') {
    return { ...submitted, end: { type: 'until', date: offsetDate(original.end.date, dayOffset) } };
  }
  return submitted;
}

function shiftWeeklyWeekdays(rule: RecurrenceRuleV1 | null, dayOffset: number): RecurrenceRuleV1 | null {
  if (rule === null || rule.frequency !== 'weekly' || dayOffset === 0) return rule;
  return {
    ...rule,
    weekdays: rule.weekdays
      .map((weekday) => ((weekday + dayOffset) % 7 + 7) % 7)
      .sort((left, right) => left - right),
  };
}

function occurrenceDates(event: CalendarEvent, from: string, through: string): readonly string[] {
  const result = expandEventOccurrences({ events: [event], from, through });
  if (!result.ok) throw new Error('Invalid recurrence mapping range');
  return result.value.map((occurrence) => occurrence.occurrenceStartDate);
}

function firstOccurrenceDates(event: CalendarEvent, count: number): readonly string[] {
  if (count === 0) return [];
  const through = format(addYears(parse(event.anchorDate, DATE_FORMAT, new Date()), 400), DATE_FORMAT);
  const dates = occurrenceDates(event, event.anchorDate, through).slice(0, count);
  if (dates.length !== count) throw new Error('Recurrence mapping does not have enough occurrences');
  return dates;
}

function rekeyExceptionsByOrdinal(input: Readonly<{
  exceptions: readonly RecurrenceException[];
  sourceEvent: CalendarEvent;
  sourceFrom: string;
  targetEvent: CalendarEvent;
  targetSeriesId: string;
  now: string;
}>): readonly RecurrenceException[] {
  if (input.exceptions.length === 0) return [];
  const maximum = input.exceptions.reduce(
    (value, exception) => exception.originalOccurrenceDate > value
      ? exception.originalOccurrenceDate
      : value,
    input.sourceFrom,
  );
  const sourceDates = occurrenceDates(input.sourceEvent, input.sourceFrom, maximum);
  const targetDates = firstOccurrenceDates(input.targetEvent, sourceDates.length);
  const targetBySource = new Map(sourceDates.map((date, index) => [date, targetDates[index]]));
  return input.exceptions.map((exception) => {
    const targetDate = targetBySource.get(exception.originalOccurrenceDate);
    if (targetDate === undefined) throw new Error('Exception must target a series occurrence');
    return {
      ...exception,
      seriesEventId: input.targetSeriesId,
      originalOccurrenceDate: targetDate,
      updatedAt: input.now,
    };
  });
}

function replacementIds(exceptions: readonly RecurrenceException[]): readonly string[] {
  return exceptions.flatMap((exception) =>
    exception.replacementEventId === null ? [] : [exception.replacementEventId]);
}

export function planFollowingMutation(
  input: PlanFollowingMutationInput,
): RecurrenceMutationPlan {
  const originalRule = input.series.event.recurrenceRule;
  if (originalRule === null) throw new Error('Following mutation requires a recurring series');
  const countBefore = occurrenceCountBefore(input.series.event, input.boundaryDate);
  const affected = input.exceptions.filter((exception) =>
    exception.seriesEventId === input.series.event.id
      && exception.originalOccurrenceDate >= input.boundaryDate);
  const recurrenceChanged = !jsonEqual(originalRule, input.submitted.event.recurrenceRule);
  const dayOffset = differenceInCalendarDays(
    parse(input.submitted.event.anchorDate, DATE_FORMAT, new Date()),
    parse(input.boundaryDate, DATE_FORMAT, new Date()),
  );
  const nextId = input.createSeriesId();
  const calculatedNextRule = nextRule(
    originalRule,
    input.submitted.event.recurrenceRule,
    countBefore,
    dayOffset,
  );
  const nextEvent: CalendarEvent = {
    ...input.submitted.event,
    id: nextId,
    recurrenceRule: recurrenceChanged
      ? calculatedNextRule
      : shiftWeeklyWeekdays(calculatedNextRule, dayOffset),
    createdAt: input.now,
    updatedAt: input.now,
  };
  const nextSeries: EventAggregate = {
    event: nextEvent,
    reminders: input.submitted.reminders.map((reminder) => ({ ...reminder, eventId: nextId })),
  };
  const previousSeries = countBefore === 0 ? null : {
    event: {
      ...input.series.event,
      recurrenceRule: previousRule(originalRule, countBefore, input.boundaryDate),
      updatedAt: input.now,
    },
    reminders: input.series.reminders,
  };
  const transferred = recurrenceChanged ? [] : rekeyExceptionsByOrdinal({
    exceptions: affected,
    sourceEvent: input.series.event,
    sourceFrom: input.boundaryDate,
    targetEvent: nextEvent,
    targetSeriesId: nextId,
    now: input.now,
  });

  return {
    removePreviousSeries: countBefore === 0,
    previousSeries,
    nextSeries,
    upsertExceptions: transferred,
    deleteExceptionIdentities: affected.map(({ seriesEventId, originalOccurrenceDate }) => ({
      seriesEventId,
      originalOccurrenceDate,
    })),
    deleteReplacementEventIds: recurrenceChanged ? replacementIds(affected) : [],
  };
}

export function planSeriesMutation(input: PlanSeriesMutationInput): RecurrenceMutationPlan {
  const recurrenceChanged = !jsonEqual(
    input.series.event.recurrenceRule,
    input.submitted.event.recurrenceRule,
  );
  const dayOffset = differenceInCalendarDays(
    parse(input.submitted.event.anchorDate, DATE_FORMAT, new Date()),
    parse(input.boundaryDate, DATE_FORMAT, new Date()),
  );
  const anchorDate = offsetDate(input.series.event.anchorDate, dayOffset);
  const submittedEvent = input.submitted.event.temporalType === 'exact'
    ? { ...input.submitted.event, anchorDate }
    : {
      ...input.submitted.event,
      anchorDate,
      endDate: offsetDate(
        input.submitted.event.endDate,
        differenceInCalendarDays(
          parse(anchorDate, DATE_FORMAT, new Date()),
          parse(input.submitted.event.anchorDate, DATE_FORMAT, new Date()),
        ),
      ),
    };
  const recurrenceRuleWithEnd = !recurrenceChanged
      && submittedEvent.recurrenceRule?.end.type === 'until'
    ? {
      ...submittedEvent.recurrenceRule,
      end: {
        type: 'until' as const,
        date: offsetDate(submittedEvent.recurrenceRule.end.date, dayOffset),
      },
    }
    : submittedEvent.recurrenceRule;
  const recurrenceRule = recurrenceChanged
    ? recurrenceRuleWithEnd
    : shiftWeeklyWeekdays(recurrenceRuleWithEnd, dayOffset);
  const nextSeries: EventAggregate = {
    event: {
      ...submittedEvent,
      id: input.series.event.id,
      recurrenceRule,
      createdAt: input.series.event.createdAt,
      updatedAt: input.now,
    },
    reminders: input.submitted.reminders.map((reminder) => ({
      ...reminder,
      eventId: input.series.event.id,
    })),
  };
  const shiftedExceptions = recurrenceChanged ? [] : rekeyExceptionsByOrdinal({
    exceptions: input.exceptions,
    sourceEvent: input.series.event,
    sourceFrom: input.series.event.anchorDate,
    targetEvent: nextSeries.event,
    targetSeriesId: input.series.event.id,
    now: input.now,
  });
  return {
    removePreviousSeries: false,
    previousSeries: null,
    nextSeries,
    upsertExceptions: shiftedExceptions,
    deleteExceptionIdentities: recurrenceChanged || dayOffset !== 0
      ? input.exceptions.map(({ seriesEventId, originalOccurrenceDate }) => ({
        seriesEventId,
        originalOccurrenceDate,
      }))
      : [],
    deleteReplacementEventIds: recurrenceChanged ? replacementIds(input.exceptions) : [],
  };
}
