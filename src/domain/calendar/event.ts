import type { Result } from '@/domain/shared/result';
import { parseEventColorId, type EventColorId } from './event-color';
import { isCalendarDate } from './month';
import { parseRecurrenceRule, type RecurrenceRuleV1 } from './recurrence';
import type { ThisWeekDeadlineWeekday } from '@/domain/temporal/relative-date-resolution';
import {
  normalizeEventNoteDocument,
  parseEventNoteDocument,
  type EventNoteDocumentV1,
} from './event-note';

export type ExactDuration =
  | Readonly<{ type: 'instant' }>
  | Readonly<{ type: 'fixed'; minutes: number }>
  | Readonly<{ type: 'undetermined' }>;

export type FuzzyResolutionContextV1 = Readonly<{
  version: 1;
  referenceDate: string;
  periodAnchorDate: string;
  parameterSnapshot: Readonly<{ thisWeekDeadlineWeekday?: ThisWeekDeadlineWeekday }>;
}>;

type EventDraftBase = Readonly<{
  calendarId: string;
  title: string;
  anchorDate: string;
  createdTimeZoneId: string;
  location: string | null;
  noteDocument: EventNoteDocumentV1 | null;
  colorId: EventColorId | null;
  recurrenceRule: RecurrenceRuleV1 | null;
}>;

export type EventDraft =
  | (EventDraftBase & Readonly<{ temporalType: 'exact'; startTime: string; duration: ExactDuration }>)
  | (EventDraftBase & Readonly<{ temporalType: 'allDay'; endDate: string }>)
  | (EventDraftBase & Readonly<{
    temporalType: 'fuzzy';
    temporalDefinitionId: string;
    endDate: string;
    resolutionContext: FuzzyResolutionContextV1 | null;
  }>);

export type CalendarEvent = EventDraft &
  Readonly<{ id: string; createdAt: string; updatedAt: string }>;

export type EventValidationError = Readonly<{ field: string; message: string }>;

export type EventEditorTab = 'fuzzy' | 'exact';

const fail = (field: string, message: string): Result<never, EventValidationError> => ({
  ok: false,
  error: { field, message },
});
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const isNonBlank = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

function isWallClockTime(value: unknown): value is string {
  return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function parseFuzzyResolutionContext(value: unknown): FuzzyResolutionContextV1 | null | undefined {
  if (value === null) return null;
  if (!isRecord(value) || value.version !== 1 || !isCalendarDate(value.referenceDate) ||
      !isCalendarDate(value.periodAnchorDate) || !isRecord(value.parameterSnapshot)) return undefined;
  const deadline = value.parameterSnapshot.thisWeekDeadlineWeekday;
  if (deadline !== undefined && deadline !== 5 && deadline !== 6 && deadline !== 7) return undefined;
  return {
    version: 1,
    referenceDate: value.referenceDate,
    periodAnchorDate: value.periodAnchorDate,
    parameterSnapshot: deadline === undefined ? {} : { thisWeekDeadlineWeekday: deadline },
  };
}

export function parseExactDuration(value: unknown): Result<ExactDuration, EventValidationError> {
  if (!isRecord(value)) return fail('duration', 'duration must be an object');
  if (value.type === 'instant' || value.type === 'undetermined') {
    return { ok: true, value: { type: value.type } };
  }
  if (
    value.type === 'fixed' &&
    typeof value.minutes === 'number' &&
    Number.isSafeInteger(value.minutes) && value.minutes >= 1
  ) {
    return { ok: true, value: { type: 'fixed', minutes: value.minutes } };
  }
  return fail('duration', 'invalid exact duration');
}

export function parseEventDraft(input: unknown): Result<EventDraft, EventValidationError> {
  if (!isRecord(input)) return fail('event', 'event must be an object');
  if (!isNonBlank(input.calendarId)) return fail('calendarId', 'calendarId must not be blank');
  if (!isNonBlank(input.title)) return fail('title', 'title must not be blank');
  if (!isCalendarDate(input.anchorDate)) return fail('anchorDate', 'anchorDate must be a real date');
  if (!isNonBlank(input.createdTimeZoneId)) return fail('createdTimeZoneId', 'createdTimeZoneId must not be blank');

  const location = normalizeOptionalText(input.location);
  if (location === undefined) return fail('location', 'location must be a string or null');
  const noteDocument = parseOptionalNoteDocument(input.noteDocument);
  if (noteDocument === undefined) {
    return fail('noteDocument', 'invalid event note document');
  }
  const colorId = parseOptionalColorId(input.colorId);
  if (!colorId.ok) return colorId;
  const recurrenceRule = parseOptionalRecurrenceRule(input.recurrenceRule);
  if (!recurrenceRule.ok) return recurrenceRule;
  if (recurrenceRule.value?.end.type === 'until' && recurrenceRule.value.end.date < input.anchorDate) {
    return fail('recurrenceRule', 'recurrence until date must not be before anchor date');
  }

  const base = {
    calendarId: input.calendarId,
    title: input.title,
    anchorDate: input.anchorDate,
    createdTimeZoneId: input.createdTimeZoneId,
    location,
    noteDocument,
    colorId: colorId.value,
    recurrenceRule: recurrenceRule.value,
  };
  if (input.temporalType === 'allDay') {
    if (!isCalendarDate(input.endDate) || input.endDate < input.anchorDate) {
      return fail('endDate', 'all-day end date must not be before anchor date');
    }
    return { ok: true, value: { ...base, temporalType: 'allDay', endDate: input.endDate } };
  }
  if (input.temporalType === 'fuzzy') {
    if (!isNonBlank(input.temporalDefinitionId)) {
      return fail('temporalDefinitionId', 'fuzzy events require a temporal definition');
    }
    if (!isCalendarDate(input.endDate) || input.endDate < input.anchorDate) {
      return fail('endDate', 'fuzzy end date must not be before anchor date');
    }
    const resolutionContext = parseFuzzyResolutionContext(input.resolutionContext);
    if (resolutionContext === undefined) return fail('resolutionContext', 'invalid fuzzy resolution context');
    if (resolutionContext !== null && base.recurrenceRule !== null) {
      return fail('recurrenceRule', 'resolved relative events cannot recur');
    }
    return { ok: true, value: {
      ...base,
      temporalType: 'fuzzy',
      temporalDefinitionId: input.temporalDefinitionId,
      endDate: input.endDate,
      resolutionContext,
    } };
  }
  if (input.temporalType === 'exact') {
    if (!isWallClockTime(input.startTime)) return fail('startTime', 'invalid wall-clock time');
    const duration = parseExactDuration(input.duration);
    if (!duration.ok) return duration;
    return { ok: true, value: { ...base, temporalType: 'exact', startTime: input.startTime, duration: duration.value } };
  }
  return fail('temporalType', 'invalid temporal type');
}

function normalizeOptionalText(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return undefined;
  return value.trim().length === 0 ? null : value;
}

function parseOptionalNoteDocument(value: unknown): EventNoteDocumentV1 | null | undefined {
  if (value === null || value === undefined) return null;
  const parsed = parseEventNoteDocument(value);
  if (!parsed.ok) return undefined;
  return normalizeEventNoteDocument(parsed.value);
}

function parseOptionalColorId(value: unknown): Result<EventColorId | null, EventValidationError> {
  if (value === null || value === undefined) return { ok: true, value: null };
  return parseEventColorId(value);
}

function parseOptionalRecurrenceRule(
  value: unknown,
): Result<RecurrenceRuleV1 | null, EventValidationError> {
  if (value === null || value === undefined) return { ok: true, value: null };
  return parseRecurrenceRule(value);
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

export function createCalendarEvent(
  input: Readonly<{ id: string; draft: EventDraft; now: string }>,
): Result<CalendarEvent, EventValidationError> {
  return parseCalendarEvent({
    ...input.draft,
    id: input.id,
    createdAt: input.now,
    updatedAt: input.now,
  });
}
