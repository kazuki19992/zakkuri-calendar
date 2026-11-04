import type { HolidayProvider } from '@/domain/calendar/holiday';
import type { HolidayCalendarId } from '@/domain/calendar/holiday-preferences';

const noHolidays: HolidayProvider = { list: () => ({ status: 'available', holidays: [] }) };

export function selectHolidayProvider(japanese: HolidayProvider, calendarId: HolidayCalendarId): HolidayProvider {
  return calendarId === 'jp' ? japanese : noHolidays;
}
