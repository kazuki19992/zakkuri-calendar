export type CalendarViewMode = 'day' | 'twoDay' | 'month';

export const DEFAULT_CALENDAR_VIEW_MODE: CalendarViewMode = 'twoDay';

export function parseCalendarViewMode(value: unknown): CalendarViewMode | null {
  return value === 'day' || value === 'twoDay' || value === 'month' ? value : null;
}
