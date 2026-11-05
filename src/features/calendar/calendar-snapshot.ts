import type { EventColorId } from '@/constants/event-colors';
import type { CalendarViewMode } from '@/domain/calendar/calendar-view-mode';
import { expandEventOccurrences, type EventOccurrence } from '@/domain/calendar/event-occurrence';
import type { HolidayProvider } from '@/domain/calendar/holiday';
import { getMonthGrid, getMonthRange, getMonthStart, getTwoDayRange, getWeekRange, offsetCalendarDate, type WeekStartsOn } from '@/domain/calendar/month';
import type { CalendarRepository, EventRepository, SettingsRepository, TemporalDefinitionRepository } from '@/domain/calendar/repositories';
import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';
import { selectHolidayProvider } from '@/data/holidays/selected-holiday-provider';
import type { HolidayRangeCoverage } from './calendar-view-model';
import { TWO_DAY_SWIPE_BUFFER_DAYS, createTwoDayStripDates } from './two-day-view-model';

export type CalendarSnapshotInput = Readonly<{
  calendars: CalendarRepository;
  events: EventRepository;
  settings: Pick<SettingsRepository, 'getCalendarWeekStartsOn' | 'getHolidayPreferences' | 'getCalendarVisible' | 'getUndeterminedFadeMinutes'>;
  temporalDefinitions: TemporalDefinitionRepository;
  holidayProvider: HolidayProvider;
}>;

export type CalendarSnapshot = Readonly<{
  weekStartsOn: WeekStartsOn;
  calendarId: string;
  calendarName: string;
  calendarColorId: EventColorId;
  isCalendarVisible: boolean;
  occurrences: readonly EventOccurrence[];
  holidayCoverage: readonly HolidayRangeCoverage[];
  definitions: ReadonlyMap<string, TemporalDefinition>;
  undeterminedFadeMinutes: number;
}>;

export type ViewTarget = Readonly<{
  mode: CalendarViewMode;
  today: string;
  anchorDate: string;
  visibleMonth: string;
  selectedDate: string;
}>;

function getTargetRange(
  target: ViewTarget,
  weekStartsOn: WeekStartsOn,
): Readonly<{ from: string; through: string }> {
  if (target.mode === 'week') {
    const range = getWeekRange(target.anchorDate, weekStartsOn);
    return { from: offsetCalendarDate(range.from, -8), through: offsetCalendarDate(range.through, 7) };
  }
  if (target.mode !== 'month') {
    const range = target.mode === 'day' ? { from: target.anchorDate, through: target.anchorDate } : getTwoDayRange(target.anchorDate);
    // スワイプ用予備列(前後TWO_DAY_SWIPE_BUFFER_DAYS日)の分だけ広く取得する。
    // 前日側はさらに1日分広げ、日跨ぎ予定が予備列の左端でも継続描画できるようにする。
    return {
      from: offsetCalendarDate(range.from, -(TWO_DAY_SWIPE_BUFFER_DAYS + 1)),
      through: offsetCalendarDate(range.through, TWO_DAY_SWIPE_BUFFER_DAYS),
    };
  }
  const grid = getMonthGrid(target.visibleMonth, weekStartsOn);
  return { from: grid[0].date, through: grid[grid.length - 1].date };
}

function getHolidayMonths(target: ViewTarget, weekStartsOn: WeekStartsOn): readonly string[] {
  const dates =
    target.mode === 'week'
      ? Array.from({ length: 21 }, (_, index) => offsetCalendarDate(getWeekRange(target.anchorDate, weekStartsOn).from, index - 7))
      : target.mode === 'day'
      ? [-1, 0, 1].map((offset) => offsetCalendarDate(target.anchorDate, offset))
      : target.mode === 'twoDay'
      ? createTwoDayStripDates(getTwoDayRange(target.anchorDate), TWO_DAY_SWIPE_BUFFER_DAYS)
      : getMonthGrid(target.visibleMonth, weekStartsOn).map((day) => day.date);
  return [...new Set(dates.map(getMonthStart))];
}

export async function loadCalendarSnapshot(input: CalendarSnapshotInput, target: ViewTarget): Promise<CalendarSnapshot> {
  const weekStartsOn = await input.settings.getCalendarWeekStartsOn();
  const preferences = await input.settings.getHolidayPreferences();
  const holidayProvider = selectHolidayProvider(input.holidayProvider, preferences.calendarId);
  const calendar = await input.calendars.getDefault();
  const range = getTargetRange(target, weekStartsOn);
  const [schedule, isCalendarVisible, undeterminedFadeMinutes] = await Promise.all([
    input.events.listSchedule(calendar.id, range.from, range.through),
    input.settings.getCalendarVisible(calendar.id),
    input.settings.getUndeterminedFadeMinutes(),
  ]);
  const holidayCoverage = getHolidayMonths(target, weekStartsOn).map((month) => {
    const monthRange = getMonthRange(month);
    return {
      ...monthRange,
      result: holidayProvider.list(monthRange.from, monthRange.through),
    };
  });
  const expanded = expandEventOccurrences({ snapshot: schedule, from: range.from, through: range.through });
  if (!expanded.ok) throw new Error('event occurrence expansion failed');
  const occurrences = expanded.value;
  const fuzzyDefinitionIds = [
    ...new Set(
      occurrences
        .map((occurrence) => occurrence.event)
        .filter((event) => event.temporalType === 'fuzzy')
        .map((event) => event.temporalDefinitionId),
    ),
  ];
  const definitions = await Promise.all(
    fuzzyDefinitionIds.map((id) => input.temporalDefinitions.getById(id)),
  );

  return {
    weekStartsOn,
    calendarId: calendar.id,
    calendarName: calendar.name,
    calendarColorId: calendar.colorId,
    isCalendarVisible,
    occurrences,
    holidayCoverage,
    definitions: new Map(
      definitions.flatMap((definition) =>
        definition === null ? [] : [[definition.id, definition] as const],
      ),
    ),
    undeterminedFadeMinutes,
  };
}

