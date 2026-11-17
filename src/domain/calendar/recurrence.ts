import type { Result } from '@/domain/shared/result';
import { isCalendarDate } from './month';

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

export type RelativeRecurrenceRuleV2 = Readonly<{
  version: 2;
  kind: 'relativePeriod';
  frequency: 'weekly' | 'monthly';
  interval: number;
  end: Readonly<{ type: 'never' }> | Readonly<{ type: 'untilPeriod'; periodAnchorDate: string }> | Readonly<{ type: 'count'; count: number }>;
  deadlinePolicy: null | Readonly<{ version: 1; weekday: 5 | 6 | 7; adjustNonWorkingDays: boolean; holidayCalendarId: 'jp' | 'none' }>;
}>;
export type RecurrenceRule = RecurrenceRuleV1 | RelativeRecurrenceRuleV2;

type RecurrenceValidationError = Readonly<{ field: string; message: string }>;

const fail = (field: string, message: string): Result<never, RecurrenceValidationError> => ({
  ok: false,
  error: { field, message },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;

export function parseRecurrenceRule(value: RecurrenceRuleV1): Result<RecurrenceRuleV1, RecurrenceValidationError>;
export function parseRecurrenceRule(value: unknown): Result<RecurrenceRule, RecurrenceValidationError>;
export function parseRecurrenceRule(value: unknown): Result<RecurrenceRule, RecurrenceValidationError> {
  if (isRecord(value) && value.version === 2) return parseRelativeRule(value);
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
  } else if (value.end.type === 'until' && isCalendarDate(value.end.date)) {
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

function parseRelativeRule(value: Record<string, unknown>): Result<RelativeRecurrenceRuleV2, RecurrenceValidationError> {
  if (value.kind !== 'relativePeriod' || (value.frequency !== 'weekly' && value.frequency !== 'monthly')) return fail('frequency', 'invalid relative recurrence frequency');
  if (!isPositiveInteger(value.interval)) return fail('interval', 'invalid relative recurrence interval');
  let end: RelativeRecurrenceRuleV2['end'];
  if (!isRecord(value.end)) return fail('end', 'invalid relative recurrence end');
  if (value.end.type === 'never') end = { type: 'never' };
  else if (value.end.type === 'count' && isPositiveInteger(value.end.count)) end = { type: 'count', count: value.end.count };
  else if (value.end.type === 'untilPeriod' && isCalendarDate(value.end.periodAnchorDate)) end = { type: 'untilPeriod', periodAnchorDate: value.end.periodAnchorDate };
  else return fail('end', 'invalid relative recurrence end');
  let deadlinePolicy: RelativeRecurrenceRuleV2['deadlinePolicy'] = null;
  if (value.deadlinePolicy !== null) {
    const p = value.deadlinePolicy;
    if (!isRecord(p) || p.version !== 1 || ![5, 6, 7].includes(Number(p.weekday)) || typeof p.weekday !== 'number' || typeof p.adjustNonWorkingDays !== 'boolean' || (p.holidayCalendarId !== 'jp' && p.holidayCalendarId !== 'none')) return fail('deadlinePolicy', 'invalid deadline policy');
    deadlinePolicy = { version: 1, weekday: p.weekday as 5 | 6 | 7, adjustNonWorkingDays: p.adjustNonWorkingDays, holidayCalendarId: p.holidayCalendarId };
  }
  return { ok: true, value: { version: 2, kind: 'relativePeriod', frequency: value.frequency, interval: value.interval, end, deadlinePolicy } };
}
