import type { CalendarEvent } from '@/domain/calendar/event';
import type { MonthGridDate } from '@/domain/calendar/month';
import {
  getHolidayInfo,
  occursOnCalendarDate,
  type HolidayRangeCoverage,
  type HolidaySupport,
} from './calendar-view-model';

export {
  createAgendaItems,
  type AgendaItemViewModel,
  type HolidayRangeCoverage,
} from './calendar-view-model';

export type MonthDayViewModel = Readonly<{
  date: string;
  dayNumber: number;
  weekday: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  hasEvents: boolean;
  holidaySupport: HolidaySupport;
  holidayName: string | null;
  accessibilityLabel: string;
}>;

function formatJapaneseDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return `${year}年${month}月${day}日`;
}

function createAccessibilityLabel(
  date: string,
  holidayName: string | null,
  holidaySupport: 'available' | 'unsupported',
  isToday: boolean,
  isSelected: boolean,
  hasEvents: boolean,
): string {
  const labels = [formatJapaneseDate(date)];
  if (holidayName !== null) labels.push(holidayName);
  if (holidaySupport === 'unsupported') labels.push('祝日情報未対応');
  if (isToday) labels.push('今日');
  if (isSelected) labels.push('選択中');
  if (hasEvents) labels.push('予定あり');
  return labels.join('、');
}

export function createMonthDayViewModels(input: Readonly<{
  grid: readonly MonthGridDate[];
  selectedDate: string;
  today: string;
  events: readonly CalendarEvent[];
  holidayCoverage: readonly HolidayRangeCoverage[];
}>): readonly MonthDayViewModel[] {
  return input.grid.map((gridDate) => {
    const isToday = gridDate.date === input.today;
    const isSelected = gridDate.date === input.selectedDate;
    const hasEvents = input.events.some((event) => occursOnCalendarDate(event, gridDate.date));
    const holiday = getHolidayInfo(gridDate.date, input.holidayCoverage);

    return {
      ...gridDate,
      isToday,
      isSelected,
      hasEvents,
      holidaySupport: holiday.support,
      holidayName: holiday.name,
      accessibilityLabel: createAccessibilityLabel(
        gridDate.date,
        holiday.name,
        holiday.support,
        isToday,
        isSelected,
        hasEvents,
      ),
    };
  });
}
