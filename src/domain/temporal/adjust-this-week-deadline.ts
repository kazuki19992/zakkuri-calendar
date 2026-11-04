import { addDays, getISODay, parse } from 'date-fns';
import type { HolidayRangeResult } from '@/domain/calendar/holiday';
import type { HolidayPreferencesV1 } from '@/domain/calendar/holiday-preferences';
import { toCalendarDate } from '@/domain/calendar/month';
import type { Result } from '@/domain/shared/result';
import type { RelativeDateResolution } from './relative-date-resolution';

export type DeadlineAdjustmentError = 'noBusinessDay' | 'unsupportedHolidayRange';

export function adjustThisWeekDeadline(
  resolution: RelativeDateResolution,
  preferences: HolidayPreferencesV1,
  holidays: HolidayRangeResult,
): Result<RelativeDateResolution, DeadlineAdjustmentError> {
  if (!preferences.adjustThisWeekDeadline) return { ok: true, value: resolution };
  if (preferences.calendarId === 'jp' && holidays.status === 'unsupported') {
    return { ok: false, error: 'unsupportedHolidayRange' };
  }
  const excluded = new Set(preferences.calendarId === 'jp' && holidays.status === 'available'
    ? holidays.holidays.map((holiday) => holiday.date) : []);
  let date = parse(resolution.endDate, 'yyyy-MM-dd', new Date());
  while (toCalendarDate(date) >= resolution.referenceDate) {
    const candidate = toCalendarDate(date);
    if (getISODay(date) <= 5 && !excluded.has(candidate)) return { ok: true, value: {
      ...resolution,
      endDate: candidate,
      parameterSnapshot: { ...resolution.parameterSnapshot, deadlineAdjustment: {
        version: 1, calendarId: preferences.calendarId, unadjustedDeadlineDate: resolution.endDate,
      } },
    } };
    date = addDays(date, -1);
  }
  return { ok: false, error: 'noBusinessDay' };
}
