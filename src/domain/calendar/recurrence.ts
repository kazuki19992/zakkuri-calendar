import type { Result } from '@/domain/shared/result';

export type RecurrenceRuleV1 = Readonly<{
  version: 1;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  weekdays: readonly number[];
  end:
    | Readonly<{ type: 'never' }>
    | Readonly<{ type: 'until'; date: string }>
    | Readonly<{ type: 'count'; count: number }>;
}>;

type RecurrenceValidationError = Readonly<{ field: string; message: string }>;

const fail = (field: string, message: string): Result<never, RecurrenceValidationError> => ({
  ok: false,
  error: { field, message },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

function isRealDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;

export function parseRecurrenceRule(value: unknown): Result<RecurrenceRuleV1, RecurrenceValidationError> {
  if (!isRecord(value) || value.version !== 1) return fail('recurrenceRule', 'unsupported recurrence rule version');
  if (!['daily', 'weekly', 'monthly', 'yearly'].includes(String(value.frequency))) {
    return fail('frequency', 'invalid recurrence frequency');
  }
  if (!isPositiveInteger(value.interval)) return fail('interval', 'interval must be a positive integer');
  if (!Array.isArray(value.weekdays) || value.weekdays.some((weekday) =>
    typeof weekday !== 'number' || !Number.isInteger(weekday) || weekday < 0 || weekday > 6,
  )) {
    return fail('weekdays', 'weekdays must contain integers from 0 through 6');
  }

  let end: RecurrenceRuleV1['end'];
  if (!isRecord(value.end)) return fail('end', 'invalid recurrence end');
  if (value.end.type === 'never') {
    end = { type: 'never' };
  } else if (value.end.type === 'until' && isRealDate(value.end.date)) {
    end = { type: 'until', date: value.end.date };
  } else if (value.end.type === 'count' && isPositiveInteger(value.end.count)) {
    end = { type: 'count', count: value.end.count };
  } else {
    return fail('end', 'invalid recurrence end');
  }

  const frequency = value.frequency as RecurrenceRuleV1['frequency'];
  const weekdays = frequency === 'weekly'
    ? [...new Set(value.weekdays as number[])].sort((first, second) => first - second)
    : [];
  return {
    ok: true,
    value: { version: 1, frequency, interval: value.interval, weekdays, end },
  };
}
