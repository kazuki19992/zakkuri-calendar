import type { Result } from '@/domain/shared/result';

export type ExactDuration =
  | Readonly<{ type: 'instant' }>
  | Readonly<{ type: 'fixed'; minutes: 10 | 15 | 30 | 60 }>
  | Readonly<{ type: 'undetermined' }>;

type EventDraftBase = Readonly<{
  calendarId: string;
  title: string;
  anchorDate: string;
  createdTimeZoneId: string;
}>;

export type EventDraft =
  | (EventDraftBase & Readonly<{ temporalType: 'exact'; startTime: string; duration: ExactDuration }>)
  | (EventDraftBase & Readonly<{ temporalType: 'allDay' }>)
  | (EventDraftBase & Readonly<{ temporalType: 'fuzzy'; temporalDefinitionId: string }>);

export type CalendarEvent = EventDraft &
  Readonly<{ id: string; createdAt: string; updatedAt: string }>;

export type EventValidationError = Readonly<{ field: string; message: string }>;

const fail = (field: string, message: string): Result<never, EventValidationError> => ({
  ok: false,
  error: { field, message },
});
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const isNonBlank = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

function isRealDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isWallClockTime(value: unknown): value is string {
  return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function parseExactDuration(value: unknown): Result<ExactDuration, EventValidationError> {
  if (!isRecord(value)) return fail('duration', 'duration must be an object');
  if (value.type === 'instant' || value.type === 'undetermined') {
    return { ok: true, value: { type: value.type } };
  }
  if (
    value.type === 'fixed' &&
    typeof value.minutes === 'number' &&
    [10, 15, 30, 60].includes(value.minutes)
  ) {
    return { ok: true, value: { type: 'fixed', minutes: value.minutes as 10 | 15 | 30 | 60 } };
  }
  return fail('duration', 'invalid exact duration');
}

export function parseEventDraft(input: unknown): Result<EventDraft, EventValidationError> {
  if (!isRecord(input)) return fail('event', 'event must be an object');
  if (!isNonBlank(input.calendarId)) return fail('calendarId', 'calendarId must not be blank');
  if (!isNonBlank(input.title)) return fail('title', 'title must not be blank');
  if (!isRealDate(input.anchorDate)) return fail('anchorDate', 'anchorDate must be a real date');
  if (!isNonBlank(input.createdTimeZoneId)) return fail('createdTimeZoneId', 'createdTimeZoneId must not be blank');

  const base = {
    calendarId: input.calendarId,
    title: input.title,
    anchorDate: input.anchorDate,
    createdTimeZoneId: input.createdTimeZoneId,
  };
  if (input.temporalType === 'allDay') return { ok: true, value: { ...base, temporalType: 'allDay' } };
  if (input.temporalType === 'fuzzy') {
    if (!isNonBlank(input.temporalDefinitionId)) {
      return fail('temporalDefinitionId', 'fuzzy events require a temporal definition');
    }
    return { ok: true, value: { ...base, temporalType: 'fuzzy', temporalDefinitionId: input.temporalDefinitionId } };
  }
  if (input.temporalType === 'exact') {
    if (!isWallClockTime(input.startTime)) return fail('startTime', 'invalid wall-clock time');
    const duration = parseExactDuration(input.duration);
    if (!duration.ok) return duration;
    return { ok: true, value: { ...base, temporalType: 'exact', startTime: input.startTime, duration: duration.value } };
  }
  return fail('temporalType', 'invalid temporal type');
}

export function parseCalendarEvent(input: unknown): Result<CalendarEvent, EventValidationError> {
  if (!isRecord(input)) return fail('event', 'event must be an object');
  const draft = parseEventDraft(input);
  if (!draft.ok) return draft;
  if (!isNonBlank(input.id)) return fail('id', 'id must not be blank');
  if (!isNonBlank(input.createdAt)) return fail('createdAt', 'createdAt must not be blank');
  if (!isNonBlank(input.updatedAt)) return fail('updatedAt', 'updatedAt must not be blank');
  return { ok: true, value: { ...draft.value, id: input.id, createdAt: input.createdAt, updatedAt: input.updatedAt } };
}
