import type { CalendarEvent } from '@/domain/calendar/event';
import type { HolidayRangeResult } from '@/domain/calendar/holiday';
import type { MonthGridDate } from '@/domain/calendar/month';

export type MonthDayViewModel = Readonly<{
  date: string;
  dayNumber: number;
  weekday: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  hasEvents: boolean;
  holidayName: string | null;
  accessibilityLabel: string;
}>;

export type AgendaItemViewModel = Readonly<{
  id: string;
  title: string;
  temporalLabel: string;
  accessibilityLabel: string;
}>;

function formatJapaneseDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return `${year}年${month}月${day}日`;
}

function getHolidayName(date: string, holidayResult: HolidayRangeResult): string | null {
  if (holidayResult.status === 'unsupported') return null;
  return holidayResult.holidays.find((holiday) => holiday.date === date)?.name ?? null;
}

function createAccessibilityLabel(
  date: string,
  holidayName: string | null,
  isToday: boolean,
  isSelected: boolean,
  hasEvents: boolean,
): string {
  const labels = [formatJapaneseDate(date)];
  if (holidayName !== null) labels.push(holidayName);
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
  holidayResult: HolidayRangeResult;
}>): readonly MonthDayViewModel[] {
  return input.grid.map((gridDate) => {
    const isToday = gridDate.date === input.today;
    const isSelected = gridDate.date === input.selectedDate;
    const hasEvents = input.events.some((event) => event.anchorDate === gridDate.date);
    const holidayName = getHolidayName(gridDate.date, input.holidayResult);

    return {
      ...gridDate,
      isToday,
      isSelected,
      hasEvents,
      holidayName,
      accessibilityLabel: createAccessibilityLabel(
        gridDate.date,
        holidayName,
        isToday,
        isSelected,
        hasEvents,
      ),
    };
  });
}

function getTemporalLabel(event: CalendarEvent, definitionLabels: ReadonlyMap<string, string>): string {
  if (event.temporalType === 'exact') return event.startTime;
  if (event.temporalType === 'allDay') return '終日';

  const definitionLabel = definitionLabels.get(event.temporalDefinitionId);
  return definitionLabel !== undefined && definitionLabel.trim().length > 0 ? definitionLabel : 'ざっくり';
}

export function createAgendaItems(
  events: readonly CalendarEvent[],
  definitionLabels: ReadonlyMap<string, string>,
): readonly AgendaItemViewModel[] {
  return events.map((event) => {
    const temporalLabel = getTemporalLabel(event, definitionLabels);
    return {
      id: event.id,
      title: event.title,
      temporalLabel,
      accessibilityLabel: `${event.title}、${temporalLabel}`,
    };
  });
}
