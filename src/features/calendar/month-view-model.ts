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
  holidaySupport: 'available' | 'unsupported';
  holidayName: string | null;
  accessibilityLabel: string;
}>;

export type HolidayRangeCoverage = Readonly<{
  from: string;
  through: string;
  result: HolidayRangeResult;
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

function getHolidayInfo(
  date: string,
  holidayCoverage: readonly HolidayRangeCoverage[],
): Readonly<{ support: 'available' | 'unsupported'; name: string | null }> {
  const coverage = holidayCoverage.find((item) => item.from <= date && date <= item.through);
  if (coverage === undefined || coverage.result.status === 'unsupported') {
    return { support: 'unsupported', name: null };
  }
  return {
    support: 'available',
    name: coverage.result.holidays.find((holiday) => holiday.date === date)?.name ?? null,
  };
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
    const hasEvents = input.events.some((event) => event.anchorDate === gridDate.date);
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
