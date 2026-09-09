import type { CalendarEvent } from '@/domain/calendar/event';
import type { TwoDayRange } from '@/domain/calendar/month';
import { getDay, parse } from 'date-fns';
import {
  createAgendaItems,
  getHolidayInfo,
  type AgendaItemViewModel,
  type HolidayRangeCoverage,
  type HolidaySupport,
} from './calendar-view-model';

const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土'] as const;

export type TwoDayViewModel = Readonly<{
  date: string;
  dateLabel: string;
  weekdayLabel: string;
  isToday: boolean;
  holidayName: string | null;
  holidaySupport: HolidaySupport;
  items: readonly AgendaItemViewModel[];
  accessibilityLabel: string;
}>;

function getDateParts(date: string): readonly [number, number, number] {
  const [year, month, day] = date.split('-').map(Number);
  return [year, month, day];
}

function createDayViewModel(
  date: string,
  input: Readonly<{
    today: string;
    events: readonly CalendarEvent[];
    definitionLabels: ReadonlyMap<string, string>;
    holidayCoverage: readonly HolidayRangeCoverage[];
  }>,
): TwoDayViewModel {
  const [year, month, day] = getDateParts(date);
  const weekdayLabel = weekdayLabels[getDay(parse(date, 'yyyy-MM-dd', new Date()))];
  const holiday = getHolidayInfo(date, input.holidayCoverage);
  const isToday = date === input.today;
  const items = createAgendaItems(
    input.events.filter((event) => event.anchorDate === date),
    input.definitionLabels,
  );
  const labels = [`${year}年${month}月${day}日`, `${weekdayLabel}曜日`];
  if (holiday.name !== null) labels.push(holiday.name);
  if (holiday.support === 'unsupported') labels.push('祝日情報未対応');
  if (isToday) labels.push('今日');
  labels.push(items.length === 0 ? '予定なし' : `予定${items.length}件`);

  return {
    date,
    dateLabel: `${month}月${day}日`,
    weekdayLabel,
    isToday,
    holidayName: holiday.name,
    holidaySupport: holiday.support,
    items,
    accessibilityLabel: labels.join('、'),
  };
}

export function createTwoDayViewModels(input: Readonly<{
  range: TwoDayRange;
  today: string;
  events: readonly CalendarEvent[];
  definitionLabels: ReadonlyMap<string, string>;
  holidayCoverage: readonly HolidayRangeCoverage[];
}>): readonly [TwoDayViewModel, TwoDayViewModel] {
  return [createDayViewModel(input.range.from, input), createDayViewModel(input.range.through, input)];
}
