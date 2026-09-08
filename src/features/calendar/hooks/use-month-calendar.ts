import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CalendarEvent } from '@/domain/calendar/event';
import type { HolidayProvider, HolidayRangeResult } from '@/domain/calendar/holiday';
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

const unsupportedHolidays: HolidayRangeResult = { status: 'unsupported' };

export function useMonthCalendar(input: UseMonthCalendarInput): MonthCalendarState {
  const [today] = useState(() => toCalendarDate((input.now ?? (() => new Date()))()));
  const [visibleMonth, setVisibleMonth] = useState(() => getMonthStart(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const [status, setStatus] = useState<MonthCalendarStatus>('loading');
  const [monthEvents, setMonthEvents] = useState<readonly CalendarEvent[]>([]);
  const [holidayResult, setHolidayResult] = useState<HolidayRangeResult>(unsupportedHolidays);
  const [definitionLabels, setDefinitionLabels] = useState<ReadonlyMap<string, string>>(
    () => new Map(),
  );
  const [retryKey, setRetryKey] = useState(0);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const range = getMonthRange(visibleMonth);

    void (async () => {
      try {
        const calendar = await input.calendars.getDefault();
        const events = await input.events.listByAnchorRange(calendar.id, range.from, range.through);
        const holidays = input.holidayProvider.list(range.from, range.through);
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
        setHolidayResult(holidays);
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
        setHolidayResult(unsupportedHolidays);
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
    retryKey,
    visibleMonth,
  ]);

  const days = useMemo(
    () =>
      createMonthDayViewModels({
        grid: getMonthGrid(visibleMonth, input.weekStartsOn),
        selectedDate,
        today,
        events: monthEvents,
        holidayResult,
      }),
    [holidayResult, input.weekStartsOn, monthEvents, selectedDate, today, visibleMonth],
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
    setStatus('loading');
    setMonthEvents([]);
    setHolidayResult(unsupportedHolidays);
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
    if (visibleMonth !== getMonthStart(today)) prepareForLoad();
    setVisibleMonth(getMonthStart(today));
    setSelectedDate(today);
  }, [prepareForLoad, today, visibleMonth]);
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

  return {
    status,
    visibleMonth,
    selectedDate,
    today,
    days,
    agendaItems,
    selectedHolidayName:
      holidayResult.status === 'available'
        ? holidayResult.holidays.find((holiday) => holiday.date === selectedDate)?.name ?? null
        : null,
    holidaySupport: holidayResult.status,
    showPreviousMonth,
    showNextMonth,
    showToday,
    selectDate,
    retry,
  };
}
