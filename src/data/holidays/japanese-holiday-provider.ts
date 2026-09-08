import { between } from '@gahojin-inc/holiday-japanese';
import { format, parse } from 'date-fns';
import type { Holiday, HolidayProvider, HolidayRangeResult } from '@/domain/calendar/holiday';

export const JAPANESE_HOLIDAY_MIN_YEAR = 1970;
export const JAPANESE_HOLIDAY_MAX_YEAR = 2050;

const CALENDAR_DATE_FORMAT = 'yyyy-MM-dd';

function parseCalendarDate(date: string): Date {
  return parse(date, CALENDAR_DATE_FORMAT, new Date());
}

function getYear(date: string): number {
  return Number.parseInt(date.slice(0, 4), 10);
}

export class JapaneseHolidayProvider implements HolidayProvider {
  list(from: string, through: string): HolidayRangeResult {
    const fromYear = getYear(from);
    const throughYear = getYear(through);
    if (
      fromYear < JAPANESE_HOLIDAY_MIN_YEAR ||
      fromYear > JAPANESE_HOLIDAY_MAX_YEAR ||
      throughYear < JAPANESE_HOLIDAY_MIN_YEAR ||
      throughYear > JAPANESE_HOLIDAY_MAX_YEAR
    ) {
      return { status: 'unsupported' };
    }

    const holidays: readonly Holiday[] = between(parseCalendarDate(from), parseCalendarDate(through)).map(
      (holiday) => ({
        date: format(holiday.date, CALENDAR_DATE_FORMAT),
        name: holiday.nameJa,
      }),
    );
    // TODO(v1, #9): 祝日カレンダーと、ざっくり期間・業務日計算への反映を設定可能にする。
    return { status: 'available', holidays };
  }
}
