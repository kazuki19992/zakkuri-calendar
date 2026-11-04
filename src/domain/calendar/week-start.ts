import type { WeekStartsOn } from './month';

export const DEFAULT_CALENDAR_WEEK_STARTS_ON: WeekStartsOn = 1;

export function parseCalendarWeekStartsOn(value: unknown): WeekStartsOn | null {
  return value === 0 || value === 1 ? value : null;
}
