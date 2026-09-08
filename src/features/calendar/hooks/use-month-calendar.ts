import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CalendarEvent } from '@/domain/calendar/event';
import type { HolidayProvider } from '@/domain/calendar/holiday';
import {
  getMonthGrid,
  getMonthRange,
  getMonthStart,
  moveMonth,
  toCalendarDate,
  type WeekStartsOn,
} from '@/domain/calendar/month';
import type {
  CalendarRepository,
  EventRepository,
  TemporalDefinitionRepository,
} from '@/domain/calendar/repositories';
import {
  createAgendaItems,
  createMonthDayViewModels,
  type AgendaItemViewModel,
  type HolidayRangeCoverage,
  type MonthDayViewModel,
} from '../month-view-model';

export type MonthCalendarStatus = 'loading' | 'ready' | 'error';

export type UseMonthCalendarInput = Readonly<{
  calendars: CalendarRepository;
  events: EventRepository;
  temporalDefinitions: TemporalDefinitionRepository;
  holidayProvider: HolidayProvider;
  weekStartsOn: WeekStartsOn;
  now?: () => Date;
}>;

export type MonthCalendarState = Readonly<{
  status: MonthCalendarStatus;
  visibleMonth: string;
  selectedDate: string;
  today: string;
  days: readonly MonthDayViewModel[];
  agendaItems: readonly AgendaItemViewModel[];
  selectedHolidayName: string | null;
  holidaySupport: 'available' | 'unsupported';
  showPreviousMonth(): void;
  showNextMonth(): void;
  showToday(): void;
  selectDate(date: string): void;
  retry(): void;
}>;

function getSystemTime(): Date {
  return new Date();
}

function createHolidayCoverage(
  grid: readonly Readonly<{ date: string }>[],
  holidayProvider: HolidayProvider,
): readonly HolidayRangeCoverage[] {
  const monthStarts = [...new Set(grid.map((day) => getMonthStart(day.date)))];
  return monthStarts.map((month) => {
    const range = getMonthRange(month);
    return { ...range, result: holidayProvider.list(range.from, range.through) };
  });
}

export function useMonthCalendar(input: UseMonthCalendarInput): MonthCalendarState {
  const now = input.now ?? getSystemTime;
  const [today, setToday] = useState(() => toCalendarDate(now()));
  const [visibleMonth, setVisibleMonth] = useState(() => getMonthStart(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const [status, setStatus] = useState<MonthCalendarStatus>('loading');
  const [monthEvents, setMonthEvents] = useState<readonly CalendarEvent[]>([]);
  const [holidayCoverage, setHolidayCoverage] = useState<readonly HolidayRangeCoverage[]>([]);
  const [definitionLabels, setDefinitionLabels] = useState<ReadonlyMap<string, string>>(
    () => new Map(),
  );
  const [retryKey, setRetryKey] = useState(0);
  const requestIdRef = useRef(0);
  const monthGrid = useMemo(
    () => getMonthGrid(visibleMonth, input.weekStartsOn),
    [input.weekStartsOn, visibleMonth],
  );

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const range = getMonthRange(visibleMonth);

    void (async () => {
      try {
        const calendar = await input.calendars.getDefault();
        if (requestId !== requestIdRef.current) return;
        const events = await input.events.listByAnchorRange(calendar.id, range.from, range.through);
        if (requestId !== requestIdRef.current) return;
        const holidays = createHolidayCoverage(monthGrid, input.holidayProvider);
        const fuzzyDefinitionIds = [
          ...new Set(
            events
              .filter((event) => event.temporalType === 'fuzzy')
              .map((event) => event.temporalDefinitionId),
          ),
        ];
        const definitions = await Promise.all(
          fuzzyDefinitionIds.map((id) => input.temporalDefinitions.getById(id)),
        );
        if (requestId !== requestIdRef.current) return;
        setMonthEvents(events);
        setHolidayCoverage(holidays);
        setDefinitionLabels(
          new Map(
            definitions.flatMap((definition) =>
              definition === null ? [] : [[definition.id, definition.label] as const],
            ),
          ),
        );
        setStatus('ready');
      } catch {
        if (requestId !== requestIdRef.current) return;
        setMonthEvents([]);
        setHolidayCoverage([]);
        setDefinitionLabels(new Map());
        setStatus('error');
      }
    })();

    return () => {
      if (requestIdRef.current === requestId) requestIdRef.current += 1;
    };
  }, [
    input.calendars,
    input.events,
    input.holidayProvider,
    input.temporalDefinitions,
    monthGrid,
    retryKey,
    visibleMonth,
  ]);

  const days = useMemo(
    () =>
      createMonthDayViewModels({
        grid: monthGrid,
        selectedDate,
        today,
        events: monthEvents,
        holidayCoverage,
      }),
    [holidayCoverage, monthEvents, monthGrid, selectedDate, today],
  );
  const agendaItems = useMemo(
    () =>
      createAgendaItems(
        monthEvents.filter((event) => event.anchorDate === selectedDate),
        definitionLabels,
      ),
    [definitionLabels, monthEvents, selectedDate],
  );
  const prepareForLoad = useCallback(() => {
    requestIdRef.current += 1;
    setStatus('loading');
    setMonthEvents([]);
    setHolidayCoverage([]);
    setDefinitionLabels(new Map());
  }, []);
  const showPreviousMonth = useCallback(() => {
    const previousMonth = moveMonth(visibleMonth, -1);
    prepareForLoad();
    setVisibleMonth(previousMonth);
    setSelectedDate(previousMonth);
  }, [prepareForLoad, visibleMonth]);
  const showNextMonth = useCallback(() => {
    const nextMonth = moveMonth(visibleMonth, 1);
    prepareForLoad();
    setVisibleMonth(nextMonth);
    setSelectedDate(nextMonth);
  }, [prepareForLoad, visibleMonth]);
  const showToday = useCallback(() => {
    const currentToday = toCalendarDate(now());
    const currentMonth = getMonthStart(currentToday);
    if (visibleMonth !== currentMonth) prepareForLoad();
    setToday(currentToday);
    setVisibleMonth(currentMonth);
    setSelectedDate(currentToday);
  }, [now, prepareForLoad, visibleMonth]);
  const selectDate = useCallback(
    (date: string) => {
      const selectedMonth = getMonthStart(date);
      if (selectedMonth !== visibleMonth) prepareForLoad();
      setVisibleMonth(selectedMonth);
      setSelectedDate(date);
    },
    [prepareForLoad, visibleMonth],
  );
  const retry = useCallback(() => {
    prepareForLoad();
    setRetryKey((key) => key + 1);
  }, [prepareForLoad]);
  const selectedDay = days.find((day) => day.date === selectedDate);

  return {
    status,
    visibleMonth,
    selectedDate,
    today,
    days,
    agendaItems,
    selectedHolidayName: selectedDay?.holidayName ?? null,
    holidaySupport: selectedDay?.holidaySupport ?? 'unsupported',
    showPreviousMonth,
    showNextMonth,
    showToday,
    selectDate,
    retry,
  };
}
