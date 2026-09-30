import type { EventOccurrence } from '@/domain/calendar/event-occurrence';
import type { MonthGridDate } from '@/domain/calendar/month';
import {
  getHolidayInfo,
  isResolvedRelativeEvent,
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
  hasFixedEvents?: boolean;
  hasFuzzyRangeEvents?: boolean;
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
  hasFuzzyRangeEvents: boolean,
): string {
  const labels = [formatJapaneseDate(date)];
  if (holidayName !== null) labels.push(holidayName);
  if (holidaySupport === 'unsupported') labels.push('祝日情報未対応');
  if (isToday) labels.push('今日');
  if (isSelected) labels.push('選択中');
  if (hasEvents) labels.push('予定あり');
  if (hasFuzzyRangeEvents) labels.push('相対予定あり');
  return labels.join('、');
}

export function createMonthDayViewModels(input: Readonly<{
  grid: readonly MonthGridDate[];
  selectedDate: string;
  today: string;
  occurrences: readonly EventOccurrence[];
  holidayCoverage: readonly HolidayRangeCoverage[];
}>): readonly MonthDayViewModel[] {
  return input.grid.map((gridDate) => {
    const isToday = gridDate.date === input.today;
    const isSelected = gridDate.date === input.selectedDate;
    const occurrencesForDate = input.occurrences.filter((occurrence) =>
      occursOnCalendarDate(occurrence, gridDate.date));
    const hasFuzzyRangeEvents = occurrencesForDate.some((occurrence) =>
      isResolvedRelativeEvent(occurrence.event));
    const hasFixedEvents = occurrencesForDate.some((occurrence) =>
      !isResolvedRelativeEvent(occurrence.event));
    const hasEvents = occurrencesForDate.length > 0;
    const holiday = getHolidayInfo(gridDate.date, input.holidayCoverage);

    return {
      ...gridDate,
      isToday,
      isSelected,
      hasEvents,
      ...(hasFuzzyRangeEvents ? { hasFixedEvents, hasFuzzyRangeEvents } : {}),
      holidaySupport: holiday.support,
      holidayName: holiday.name,
      accessibilityLabel: createAccessibilityLabel(
        gridDate.date,
        holiday.name,
        holiday.support,
        isToday,
        isSelected,
        hasEvents,
        hasFuzzyRangeEvents,
      ),
    };
  });
}
