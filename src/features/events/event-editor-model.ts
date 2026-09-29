import { differenceInCalendarDays, parseISO } from 'date-fns';
import type {
  CalendarEvent,
  EventValidationError,
  ExactDuration,
} from '@/domain/calendar/event';
import {
  normalizeEventReminders,
  type EventReminder,
} from '@/domain/calendar/event-reminder';
import { isCalendarDate, offsetCalendarDate } from '@/domain/calendar/month';
import { parseRecurrenceRule, type RecurrenceRuleV1 } from '@/domain/calendar/recurrence';
import type { Result } from '@/domain/shared/result';
import {
  createFixedDurationFromDateTimes,
  toMinutesOfDay,
  toWallClockTime,
} from '@/domain/calendar/time';

const MINUTES_PER_DAY = 24 * 60;
const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const;
const WEEKDAYS = [1, 2, 3, 4, 5] as const;

export type ExactEditorRange = Readonly<{
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}>;

export type RecurrencePreset =
  | 'none'
  | 'daily'
  | 'weekly'
  | 'weekdays'
  | 'monthly'
  | 'yearly'
  | 'custom';

export type RecurrenceDraft = Readonly<{
  preset: RecurrencePreset;
  frequency: RecurrenceRuleV1['frequency'];
  intervalText: string;
  weekdays: readonly number[];
  endType: RecurrenceRuleV1['end']['type'];
  untilDate: string;
  countText: string;
}>;

export type ReminderDraft = Readonly<{ id: string; minutesBefore: number }>;

const fail = (field: string, message: string): Result<never, EventValidationError> => ({
  ok: false,
  error: { field, message },
});

function getCalendarWeekday(date: string): number {
  return parseISO(date).getDay();
}

function hasWeekdays(actual: readonly number[], expected: readonly number[]): boolean {
  return actual.length === expected.length && expected.every((weekday) => actual.includes(weekday));
}

function parsePositiveInteger(
  value: string,
  field: string,
  message: string,
): Result<number, EventValidationError> {
  if (!/^[1-9]\d*$/.test(value)) return fail(field, message);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return fail(field, message);
  return { ok: true, value: parsed };
}

export function formatEditorDate(date: string): string {
  if (!isCalendarDate(date)) return date;
  const [year, month, day] = date.split('-').map(Number);
  const weekday = new Date(year, month - 1, day).getDay();
  return `${month}月${day}日（${WEEKDAY_LABELS[weekday]}）`;
}

export function getExactEditorRange(
  event: Extract<CalendarEvent, { temporalType: 'exact' }>,
): ExactEditorRange {
  if (event.duration.type !== 'fixed') {
    return {
      startDate: event.anchorDate,
      startTime: event.startTime,
      endDate: event.anchorDate,
      endTime: event.startTime,
    };
  }

  const startMinutes = toMinutesOfDay(event.startTime);
  if (startMinutes === null) {
    return {
      startDate: event.anchorDate,
      startTime: event.startTime,
      endDate: event.anchorDate,
      endTime: event.startTime,
    };
  }
  const totalMinutes = startMinutes + event.duration.minutes;
  const endTime = toWallClockTime(totalMinutes % MINUTES_PER_DAY) ?? event.startTime;
  return {
    startDate: event.anchorDate,
    startTime: event.startTime,
    endDate: offsetCalendarDate(event.anchorDate, Math.floor(totalMinutes / MINUTES_PER_DAY)),
    endTime,
  };
}

export function moveEditorRangeStart(
  range: ExactEditorRange,
  nextStartDate: string,
): ExactEditorRange {
  if (!isCalendarDate(range.startDate) || !isCalendarDate(range.endDate) || !isCalendarDate(nextStartDate)) {
    return { ...range, startDate: nextStartDate };
  }
  const daySpan = differenceInCalendarDays(parseISO(range.endDate), parseISO(range.startDate));
  return {
    ...range,
    startDate: nextStartDate,
    endDate: offsetCalendarDate(nextStartDate, daySpan),
  };
}

export function getEditorExactDuration(
  range: ExactEditorRange,
  existingDuration: ExactDuration | null,
): Result<ExactDuration, EventValidationError> {
  if (
    existingDuration !== null &&
    existingDuration.type !== 'fixed' &&
    range.startDate === range.endDate &&
    range.startTime === range.endTime
  ) {
    return { ok: true, value: existingDuration };
  }
  return createFixedDurationFromDateTimes(
    range.startDate,
    range.startTime,
    range.endDate,
    range.endTime,
  );
}

export function getRecurrenceDraft(
  rule: RecurrenceRuleV1 | null,
  anchorDate: string,
): RecurrenceDraft {
  if (rule === null) {
    return {
      preset: 'none',
      frequency: 'weekly',
      intervalText: '1',
      weekdays: [getCalendarWeekday(anchorDate)],
      endType: 'never',
      untilDate: anchorDate,
      countText: '1',
    };
  }

  let preset: RecurrencePreset = 'custom';
  if (rule.interval === 1 && rule.end.type === 'never') {
    if (rule.frequency === 'weekly' && hasWeekdays(rule.weekdays, WEEKDAYS)) preset = 'weekdays';
    else if (
      rule.frequency === 'weekly' &&
      hasWeekdays(rule.weekdays, [getCalendarWeekday(anchorDate)])
    ) preset = 'weekly';
    else if (rule.frequency !== 'weekly' && rule.weekdays.length === 0) preset = rule.frequency;
  }

  return {
    preset,
    frequency: rule.frequency,
    intervalText: String(rule.interval),
    weekdays: rule.weekdays,
    endType: rule.end.type,
    untilDate: rule.end.type === 'until' ? rule.end.date : anchorDate,
    countText: rule.end.type === 'count' ? String(rule.end.count) : '1',
  };
}

export function buildRecurrenceRule(
  draft: RecurrenceDraft,
  anchorDate: string,
): Result<RecurrenceRuleV1 | null, EventValidationError> {
  if (draft.preset === 'none') return { ok: true, value: null };

  if (draft.preset !== 'custom') {
    const frequency = draft.preset === 'weekdays' ? 'weekly' : draft.preset;
    const weekdays = draft.preset === 'weekdays'
      ? WEEKDAYS
      : draft.preset === 'weekly'
        ? [getCalendarWeekday(anchorDate)]
        : [];
    return {
      ok: true,
      value: { version: 1, frequency, interval: 1, weekdays, end: { type: 'never' } },
    };
  }

  const interval = parsePositiveInteger(
    draft.intervalText,
    'recurrenceInterval',
    '繰り返し間隔は1以上の整数で入力してください',
  );
  if (!interval.ok) return interval;
  if (draft.frequency === 'weekly' && draft.weekdays.length === 0) {
    return fail('recurrenceWeekdays', '曜日を1つ以上選択してください');
  }

  let end: RecurrenceRuleV1['end'];
  if (draft.endType === 'until') {
    if (!isCalendarDate(draft.untilDate) || draft.untilDate < anchorDate) {
      return fail('recurrenceUntilDate', '終了日は開始日以降にしてください');
    }
    end = { type: 'until', date: draft.untilDate };
  } else if (draft.endType === 'count') {
    const count = parsePositiveInteger(
      draft.countText,
      'recurrenceCount',
      '繰り返し回数は1以上の整数で入力してください',
    );
    if (!count.ok) return count;
    end = { type: 'count', count: count.value };
  } else {
    end = { type: 'never' };
  }

  const parsed = parseRecurrenceRule({
    version: 1,
    frequency: draft.frequency,
    interval: interval.value,
    weekdays: draft.weekdays,
    end,
  });
  return parsed.ok ? parsed : fail(parsed.error.field, parsed.error.message);
}

export function getReminderDrafts(reminders: readonly EventReminder[]): ReminderDraft[] {
  return [...reminders]
    .sort((first, second) => first.sortOrder - second.sortOrder || first.id.localeCompare(second.id))
    .map(({ id, minutesBefore }) => ({ id, minutesBefore }));
}

export function moveReminderDraft(
  reminders: readonly ReminderDraft[],
  index: number,
  offset: -1 | 1,
): ReminderDraft[] {
  const targetIndex = index + offset;
  if (index < 0 || index >= reminders.length || targetIndex < 0 || targetIndex >= reminders.length) {
    return [...reminders];
  }
  const next = [...reminders];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
}

export function buildEventReminders(
  eventId: string,
  reminders: readonly ReminderDraft[],
): Result<readonly EventReminder[], EventValidationError> {
  return normalizeEventReminders(
    eventId,
    reminders.map((reminder, sortOrder) => ({ ...reminder, eventId, sortOrder })),
  );
}
