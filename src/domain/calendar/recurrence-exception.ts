import { addDays, differenceInCalendarDays, format, parse } from 'date-fns';
import type { Result } from '@/domain/shared/result';
import type { CalendarEvent } from './event';
import { isCalendarDate } from './month';

const DATE_FORMAT = 'yyyy-MM-dd';
const OVERRIDE_FIELDS = [
  'title',
  'temporal',
  'location',
  'notes',
  'color',
  'reminders',
] as const;

export type OccurrenceIdentity = Readonly<{
  seriesEventId: string;
  originalOccurrenceDate: string;
}>;

export type EventOverrideField = (typeof OVERRIDE_FIELDS)[number];

export type RecurrenceException = OccurrenceIdentity & Readonly<{
  kind: 'deleted' | 'replaced';
  replacementEventId: string | null;
  overrideFields: readonly EventOverrideField[];
  createdAt: string;
  updatedAt: string;
}>;

export type CalendarScheduleSnapshot = Readonly<{
  events: readonly CalendarEvent[];
  exceptions: readonly RecurrenceException[];
  replacementEvents: readonly CalendarEvent[];
}>;

export type RecurrenceExceptionValidationError = Readonly<{
  field: string;
  message: string;
}>;

const fail = (
  field: string,
  message: string,
): Result<never, RecurrenceExceptionValidationError> => ({
  ok: false,
  error: { field, message },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isNonBlank = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

function parseOverrideFields(
  value: unknown,
): Result<readonly EventOverrideField[], RecurrenceExceptionValidationError> {
  if (!Array.isArray(value)) return fail('overrideFields', 'overrideFields must be an array');
  const fields = value.filter(
    (field): field is EventOverrideField =>
      typeof field === 'string' && OVERRIDE_FIELDS.includes(field as EventOverrideField),
  );
  if (fields.length !== value.length || new Set(fields).size !== fields.length) {
    return fail('overrideFields', 'overrideFields must contain unique supported fields');
  }
  return { ok: true, value: fields };
}

export function parseRecurrenceException(
  input: unknown,
): Result<RecurrenceException, RecurrenceExceptionValidationError> {
  if (!isRecord(input)) return fail('exception', 'exception must be an object');
  if (!isNonBlank(input.seriesEventId)) {
    return fail('seriesEventId', 'seriesEventId must not be blank');
  }
  if (!isCalendarDate(input.originalOccurrenceDate)) {
    return fail('originalOccurrenceDate', 'originalOccurrenceDate must be a real date');
  }
  if (!isNonBlank(input.createdAt) || !isNonBlank(input.updatedAt)) {
    return fail('timestamps', 'timestamps must not be blank');
  }
  const overrideFields = parseOverrideFields(input.overrideFields);
  if (!overrideFields.ok) return overrideFields;

  if (input.kind === 'deleted') {
    if (input.replacementEventId !== null || overrideFields.value.length !== 0) {
      return fail('kind', 'deleted exception cannot have replacement data');
    }
  } else if (input.kind === 'replaced') {
    if (!isNonBlank(input.replacementEventId) || overrideFields.value.length === 0) {
      return fail('kind', 'replaced exception requires replacement data');
    }
  } else {
    return fail('kind', 'invalid exception kind');
  }

  return { ok: true, value: {
    seriesEventId: input.seriesEventId,
    originalOccurrenceDate: input.originalOccurrenceDate,
    kind: input.kind,
    replacementEventId: input.replacementEventId,
    overrideFields: overrideFields.value,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  } };
}

function offsetDate(value: string, days: number): string {
  return format(addDays(parse(value, DATE_FORMAT, new Date()), days), DATE_FORMAT);
}

function moveSeriesEventToOccurrence(
  event: CalendarEvent,
  occurrenceDate: string,
): CalendarEvent {
  const dayOffset = differenceInCalendarDays(
    parse(occurrenceDate, DATE_FORMAT, new Date()),
    parse(event.anchorDate, DATE_FORMAT, new Date()),
  );
  if (event.temporalType === 'exact') {
    return { ...event, anchorDate: occurrenceDate, recurrenceRule: null };
  }
  return {
    ...event,
    anchorDate: occurrenceDate,
    endDate: offsetDate(event.endDate, dayOffset),
    recurrenceRule: null,
  };
}

export function materializeOccurrenceReplacement(input: Readonly<{
  seriesEvent: CalendarEvent;
  replacementEvent: CalendarEvent;
  overrideFields: readonly EventOverrideField[];
  occurrenceDate: string;
}>): CalendarEvent {
  const fields = new Set(input.overrideFields);
  const temporalSource = fields.has('temporal')
    ? { ...input.replacementEvent, recurrenceRule: null }
    : moveSeriesEventToOccurrence(input.seriesEvent, input.occurrenceDate);

  return {
    ...temporalSource,
    id: input.replacementEvent.id,
    calendarId: input.seriesEvent.calendarId,
    title: fields.has('title') ? input.replacementEvent.title : input.seriesEvent.title,
    location: fields.has('location')
      ? input.replacementEvent.location
      : input.seriesEvent.location,
    noteDocument: fields.has('notes')
      ? input.replacementEvent.noteDocument
      : input.seriesEvent.noteDocument,
    colorId: fields.has('color') ? input.replacementEvent.colorId : input.seriesEvent.colorId,
    recurrenceRule: null,
    createdAt: input.replacementEvent.createdAt,
    updatedAt: input.replacementEvent.updatedAt,
  } as CalendarEvent;
}
