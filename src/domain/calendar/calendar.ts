export const DEFAULT_CALENDAR_ID = 'personal-default';

export type Calendar = Readonly<{
  id: string;
  name: string;
  timeZoneId: string;
  createdAt: string;
  updatedAt: string;
}>;

export function createDefaultCalendar(timeZoneId: string, now: string): Calendar {
  if (timeZoneId.trim().length === 0) {
    throw new Error('timeZoneId must not be empty');
  }

  if (now.trim().length === 0) {
    throw new Error('now must not be empty');
  }

  return {
    id: DEFAULT_CALENDAR_ID,
    name: 'マイカレンダー',
    timeZoneId,
    createdAt: now,
    updatedAt: now,
  };
}
