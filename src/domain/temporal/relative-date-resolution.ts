import { addDays, addMonths, endOfMonth, getISODay, parse, startOfMonth, startOfWeek } from 'date-fns';
import { isCalendarDate, toCalendarDate } from '@/domain/calendar/month';
import type { Result } from '@/domain/shared/result';
import type { TemporalDefinition } from './temporal-definition';

export type ThisWeekDeadlineWeekday = 5 | 6 | 7;

export type RelativeDateResolution = Readonly<{
  referenceDate: string;
  periodAnchorDate: string;
  startDate: string;
  endDate: string;
  parameterSnapshot: Readonly<{ thisWeekDeadlineWeekday?: ThisWeekDeadlineWeekday }>;
}>;

export type RelativeDateResolutionError = Readonly<{ message: string }>;

const parseDate = (value: string): Date => parse(value, 'yyyy-MM-dd', new Date());
const fail = (message: string): Result<never, RelativeDateResolutionError> => ({ ok: false, error: { message } });

export function resolveRelativeDateRange(
  referenceDate: string,
  definition: TemporalDefinition,
  thisWeekDeadlineWeekday: ThisWeekDeadlineWeekday,
): Result<RelativeDateResolution, RelativeDateResolutionError> {
  if (!isCalendarDate(referenceDate)) return fail('invalid reference date');
  const resolver = definition.resolverConfig;
  const reference = parseDate(referenceDate);

  if (definition.granularity === 'week' && resolver.kind === 'week') {
    const period = addDays(startOfWeek(reference, { weekStartsOn: 1 }), resolver.selectionWeekOffset * 7);
    return { ok: true, value: {
      referenceDate,
      periodAnchorDate: toCalendarDate(period),
      startDate: toCalendarDate(addDays(period, resolver.startWeekday - 1)),
      endDate: toCalendarDate(addDays(period, resolver.endWeekday - 1)),
      parameterSnapshot: {},
    } };
  }

  if (definition.granularity === 'week' && resolver.kind === 'weekRemainder') {
    const period = startOfWeek(reference, { weekStartsOn: 1 });
    const end = getISODay(reference) > thisWeekDeadlineWeekday
      ? reference
      : addDays(period, thisWeekDeadlineWeekday - 1);
    return { ok: true, value: {
      referenceDate,
      periodAnchorDate: toCalendarDate(period),
      startDate: referenceDate,
      endDate: toCalendarDate(end),
      parameterSnapshot: { thisWeekDeadlineWeekday },
    } };
  }

  if (definition.granularity === 'month' && resolver.kind === 'monthDays') {
    const period = startOfMonth(addMonths(reference, resolver.selectionMonthOffset));
    const lastDay = endOfMonth(period).getDate();
    const startDay = Math.min(resolver.startDay, lastDay);
    const endDay = resolver.endDay === 'last' ? lastDay : Math.min(resolver.endDay, lastDay);
    return { ok: true, value: {
      referenceDate,
      periodAnchorDate: toCalendarDate(period),
      startDate: toCalendarDate(addDays(period, startDay - 1)),
      endDate: toCalendarDate(addDays(period, endDay - 1)),
      parameterSnapshot: {},
    } };
  }

  if (definition.granularity === 'month' && resolver.kind === 'monthLastDays') {
    const period = startOfMonth(addMonths(reference, resolver.selectionMonthOffset));
    const end = endOfMonth(period);
    return { ok: true, value: {
      referenceDate,
      periodAnchorDate: toCalendarDate(period),
      startDate: toCalendarDate(addDays(end, -(Math.min(resolver.count, end.getDate()) - 1))),
      endDate: toCalendarDate(end),
      parameterSnapshot: {},
    } };
  }

  return fail('definition is not a relative date definition');
}
