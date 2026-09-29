import type { CalendarEvent, EventValidationError } from './event';
import type { Result } from '@/domain/shared/result';

export type EventReminder = Readonly<{
  id: string;
  eventId: string;
  minutesBefore: number;
  sortOrder: number;
}>;

export type EventAggregate = Readonly<{
  event: CalendarEvent;
  reminders: readonly EventReminder[];
}>;

const fail = (field: string, message: string): Result<never, EventValidationError> => ({
  ok: false,
  error: { field, message },
});

const isNonBlank = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const isNonNegativeSafeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export function parseEventReminder(value: unknown): Result<EventReminder, EventValidationError> {
  if (typeof value !== 'object' || value === null) return fail('reminder', 'reminder must be an object');
  const reminder = value as Record<string, unknown>;
  if (!isNonBlank(reminder.id)) return fail('id', 'reminder id must not be blank');
  if (!isNonBlank(reminder.eventId)) return fail('eventId', 'reminder eventId must not be blank');
  if (!isNonNegativeSafeInteger(reminder.minutesBefore)) {
    return fail('minutesBefore', 'reminder minutesBefore must be a non-negative integer');
  }
  if (!isNonNegativeSafeInteger(reminder.sortOrder)) {
    return fail('sortOrder', 'reminder sortOrder must be a non-negative integer');
  }
  return {
    ok: true,
    value: {
      id: reminder.id,
      eventId: reminder.eventId,
      minutesBefore: reminder.minutesBefore,
      sortOrder: reminder.sortOrder,
    },
  };
}

export function normalizeEventReminders(
  eventId: string,
  reminders: readonly unknown[],
): Result<readonly EventReminder[], EventValidationError> {
  if (!isNonBlank(eventId)) return fail('eventId', 'event id must not be blank');

  const parsed: EventReminder[] = [];
  for (const reminder of reminders) {
    const result = parseEventReminder(reminder);
    if (!result.ok) return result;
    if (result.value.eventId !== eventId) {
      return fail('eventId', 'reminder eventId must match aggregate event id');
    }
    parsed.push(result.value);
  }

  const uniqueMinutes = new Set<number>();
  const normalized: EventReminder[] = [];
  for (const reminder of [...parsed].sort((first, second) => {
    if (first.sortOrder !== second.sortOrder) return first.sortOrder - second.sortOrder;
    if (first.id < second.id) return -1;
    if (first.id > second.id) return 1;
    return 0;
  })) {
    if (uniqueMinutes.has(reminder.minutesBefore)) continue;
    uniqueMinutes.add(reminder.minutesBefore);
    normalized.push({ ...reminder, sortOrder: normalized.length });
  }
  return { ok: true, value: normalized };
}
