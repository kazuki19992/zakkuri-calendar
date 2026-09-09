import type { CalendarEvent } from '@/domain/calendar/event';
import type { TwoDayRange } from '@/domain/calendar/month';
import { resolveEventTime } from '@/domain/temporal/resolve-event-time';
import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';
import { getDay, parse } from 'date-fns';
import {
  createAgendaItems,
  getHolidayInfo,
  type AgendaItemViewModel,
  type HolidayRangeCoverage,
  type HolidaySupport,
} from './calendar-view-model';
import { createDayTimelineItems, type TimelineItemViewModel } from './timeline-layout';

const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土'] as const;

export type TwoDayViewModel = Readonly<{
  date: string;
  dateLabel: string;
  weekdayLabel: string;
  isToday: boolean;
  holidayName: string | null;
  holidaySupport: HolidaySupport;
  allDayItems: readonly AgendaItemViewModel[];
  timelineItems: readonly TimelineItemViewModel[];
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
    definitions: ReadonlyMap<string, TemporalDefinition>;
    undeterminedFadeMinutes: number;
    holidayCoverage: readonly HolidayRangeCoverage[];
  }>,
): TwoDayViewModel {
  const [year, month, day] = getDateParts(date);
  const weekdayLabel = weekdayLabels[getDay(parse(date, 'yyyy-MM-dd', new Date()))];
  const holiday = getHolidayInfo(date, input.holidayCoverage);
  const isToday = date === input.today;
  const definitionLabels = new Map(
    [...input.definitions.values()].map((definition) => [definition.id, definition.label] as const),
  );
  const eventsForDate = input.events.filter((event) => event.anchorDate === date);
  const allDayItems = createAgendaItems(
    eventsForDate.filter((event) => {
      const definition = event.temporalType === 'fuzzy'
        ? input.definitions.get(event.temporalDefinitionId) ?? null
        : null;
      return resolveEventTime({
        event,
        definition,
        undeterminedFadeMinutes: input.undeterminedFadeMinutes,
      }).kind !== 'timed';
    }),
    definitionLabels,
  );
  const timelineItems = createDayTimelineItems({
    date,
    events: input.events,
    definitions: input.definitions,
    undeterminedFadeMinutes: input.undeterminedFadeMinutes,
  });
  const itemCount = new Set([...allDayItems, ...timelineItems].map((item) => item.id)).size;
  const labels = [`${year}年${month}月${day}日`, `${weekdayLabel}曜日`];
  if (holiday.name !== null) labels.push(holiday.name);
  if (holiday.support === 'unsupported') labels.push('祝日情報未対応');
  if (isToday) labels.push('今日');
  labels.push(itemCount === 0 ? '予定なし' : `予定${itemCount}件`);

  return {
    date,
    dateLabel: `${month}月${day}日`,
    weekdayLabel,
    isToday,
    holidayName: holiday.name,
    holidaySupport: holiday.support,
    allDayItems,
    timelineItems,
    accessibilityLabel: labels.join('、'),
  };
}

export function createTwoDayViewModels(input: Readonly<{
  range: TwoDayRange;
  today: string;
  events: readonly CalendarEvent[];
  definitions: ReadonlyMap<string, TemporalDefinition>;
  undeterminedFadeMinutes: number;
  holidayCoverage: readonly HolidayRangeCoverage[];
}>): readonly [TwoDayViewModel, TwoDayViewModel] {
  return [createDayViewModel(input.range.from, input), createDayViewModel(input.range.through, input)];
}
