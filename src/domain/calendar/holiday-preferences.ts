import { isCalendarDate } from './month';

export type HolidayCalendarId = 'jp' | 'none';
export type HolidayPreferencesV1 = Readonly<{
  version: 1;
  calendarId: HolidayCalendarId;
  adjustThisWeekDeadline: boolean;
}>;
export type DeadlineAdjustmentV1 = Readonly<{
  version: 1;
  calendarId: HolidayCalendarId;
  unadjustedDeadlineDate: string;
}>;
export const DEFAULT_HOLIDAY_PREFERENCES: HolidayPreferencesV1 = {
  version: 1, calendarId: 'jp', adjustThisWeekDeadline: false,
};

export function parseHolidayPreferences(value: unknown): HolidayPreferencesV1 | null {
  if (typeof value !== 'object' || value === null) return null;
  const input = value as Record<string, unknown>;
  if (input.version !== 1 || (input.calendarId !== 'jp' && input.calendarId !== 'none') ||
      typeof input.adjustThisWeekDeadline !== 'boolean') return null;
  return { version: 1, calendarId: input.calendarId, adjustThisWeekDeadline: input.adjustThisWeekDeadline };
}

export function parseDeadlineAdjustment(value: unknown): DeadlineAdjustmentV1 | null {
  if (typeof value !== 'object' || value === null) return null;
  const input = value as Record<string, unknown>;
  if (input.version !== 1 || (input.calendarId !== 'jp' && input.calendarId !== 'none') ||
      !isCalendarDate(input.unadjustedDeadlineDate)) return null;
  return { version: 1, calendarId: input.calendarId, unadjustedDeadlineDate: input.unadjustedDeadlineDate };
}
