import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_EVENT_COLOR_ID, type EventColorId } from '@/constants/event-colors';
import { DEFAULT_CALENDAR_ID } from '@/domain/calendar/calendar';
import type { CalendarEvent } from '@/domain/calendar/event';
import type { HolidayProvider } from '@/domain/calendar/holiday';
import {
  getMonthGrid,
  getMonthRange,
  getMonthStart,
  getTwoDayRange,
  moveMonth,
  moveTwoDayWindow,
  offsetCalendarDate,
  toCalendarDate,
  type WeekStartsOn,
} from '@/domain/calendar/month';
import type {
  CalendarRepository,
  EventRepository,
  SettingsRepository,
  TemporalDefinitionRepository,
} from '@/domain/calendar/repositories';
import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';
import {
  createAgendaItems,
  occursOnCalendarDate,
  type AgendaItemViewModel,
  type HolidayRangeCoverage,
  type HolidaySupport,
} from '../calendar-view-model';
import { createMonthDayViewModels, type MonthDayViewModel } from '../month-view-model';
import {
  TWO_DAY_SWIPE_BUFFER_DAYS,
  createTwoDayStripDates,
  createTwoDayStripViewModels,
  createTwoDayViewModels,
  type TwoDayViewModel,
} from '../two-day-view-model';

export type CalendarViewMode = 'twoDay' | 'month';
export type CalendarViewStatus = 'loading' | 'ready' | 'error';

export type UseCalendarViewInput = Readonly<{
  calendars: CalendarRepository;
  events: EventRepository;
  settings: SettingsRepository;
  temporalDefinitions: TemporalDefinitionRepository;
  holidayProvider: HolidayProvider;
  weekStartsOn: WeekStartsOn;
  refreshRevision?: number;
  now?: () => Date;
}>;

export type CalendarViewState = Readonly<{
  status: CalendarViewStatus;
  mode: CalendarViewMode;
  today: string;
  anchorDate: string;
  visibleMonth: string;
  selectedDate: string;
  twoDayDays: readonly [TwoDayViewModel, TwoDayViewModel];
  /**
   * 2日ビューの横スワイプ用に、表示2日の前後へ予備列を加えた並び。
   * ジャンプなく連続スライドできるよう、予備列分もあらかじめ取得済み。
   */
  twoDayStrip: readonly TwoDayViewModel[];
  monthDays: readonly MonthDayViewModel[];
  datePickerMonth: string;
  datePickerDays: readonly MonthDayViewModel[];
  selectedAgendaItems: readonly AgendaItemViewModel[];
  selectedHolidayName: string | null;
  holidaySupport: HolidaySupport;
  isPeriodLoading: boolean;
  periodError: string | null;
  isDatePickerLoading: boolean;
  datePickerError: string | null;
  calendarName: string;
  calendarColorId: EventColorId;
  isCalendarVisible: boolean;
  isCalendarVisibilityUpdating: boolean;
  calendarVisibilityError: string | null;
  selectMode(mode: CalendarViewMode): Promise<boolean>;
  showPreviousPeriod(): Promise<boolean>;
  showNextPeriod(): Promise<boolean>;
  showToday(): Promise<boolean>;
  showDate(date: string): Promise<boolean>;
  loadDatePickerMonth(month: string): Promise<boolean>;
  selectDate(date: string): Promise<boolean>;
  setCalendarVisible(visible: boolean): Promise<boolean>;
  retry(): Promise<boolean>;
}>;

type CalendarSnapshot = Readonly<{
  calendarId: string;
  calendarName: string;
  isCalendarVisible: boolean;
  events: readonly CalendarEvent[];
  holidayCoverage: readonly HolidayRangeCoverage[];
  definitions: ReadonlyMap<string, TemporalDefinition>;
  undeterminedFadeMinutes: number;
}>;

type ViewTarget = Readonly<{
  mode: CalendarViewMode;
  today: string;
  anchorDate: string;
  visibleMonth: string;
  selectedDate: string;
}>;

type InternalState = ViewTarget &
  Readonly<{
    status: CalendarViewStatus;
    snapshot: CalendarSnapshot;
    isPeriodLoading: boolean;
    periodError: string | null;
    isCalendarVisibilityUpdating: boolean;
    calendarVisibilityError: string | null;
  }>;

type DatePickerState = Readonly<{
  month: string;
  snapshot: CalendarSnapshot;
  isLoading: boolean;
  error: string | null;
}>;

const emptySnapshot: CalendarSnapshot = {
  calendarId: DEFAULT_CALENDAR_ID,
  calendarName: 'マイカレンダー',
  isCalendarVisible: true,
  events: [],
  holidayCoverage: [],
  definitions: new Map(),
  undeterminedFadeMinutes: 120,
};

function getSystemTime(): Date {
  return new Date();
}

function getTargetRange(
  target: ViewTarget,
  weekStartsOn: WeekStartsOn,
): Readonly<{ from: string; through: string }> {
  if (target.mode === 'twoDay') {
    const range = getTwoDayRange(target.anchorDate);
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
    target.mode === 'twoDay'
      ? createTwoDayStripDates(getTwoDayRange(target.anchorDate), TWO_DAY_SWIPE_BUFFER_DAYS)
      : getMonthGrid(target.visibleMonth, weekStartsOn).map((day) => day.date);
  return [...new Set(dates.map(getMonthStart))];
}

async function loadSnapshot(input: UseCalendarViewInput, target: ViewTarget): Promise<CalendarSnapshot> {
  const calendar = await input.calendars.getDefault();
  const range = getTargetRange(target, input.weekStartsOn);
  const [events, isCalendarVisible, undeterminedFadeMinutes] = await Promise.all([
    input.events.listByAnchorRange(calendar.id, range.from, range.through),
    input.settings.getCalendarVisible(calendar.id),
    input.settings.getUndeterminedFadeMinutes(),
  ]);
  const holidayCoverage = getHolidayMonths(target, input.weekStartsOn).map((month) => {
    const monthRange = getMonthRange(month);
    return {
      ...monthRange,
      result: input.holidayProvider.list(monthRange.from, monthRange.through),
    };
  });
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

  return {
    calendarId: calendar.id,
    calendarName: calendar.name,
    isCalendarVisible,
    events,
    holidayCoverage,
    definitions: new Map(
      definitions.flatMap((definition) =>
        definition === null ? [] : [[definition.id, definition] as const],
      ),
    ),
    undeterminedFadeMinutes,
  };
}

export function useCalendarView(input: UseCalendarViewInput): CalendarViewState {
  const inputRef = useRef(input);
  const [state, setState] = useState<InternalState>(() => {
    const today = toCalendarDate((input.now ?? getSystemTime)());
    return {
      status: 'loading',
      // TODO(v1, #16): 最後に開いた表示モードを設定として永続化する。
      mode: 'twoDay',
      today,
      anchorDate: today,
      visibleMonth: getMonthStart(today),
      selectedDate: today,
      snapshot: emptySnapshot,
      isPeriodLoading: false,
      periodError: null,
      isCalendarVisibilityUpdating: false,
      calendarVisibilityError: null,
    };
  });
  const stateRef = useRef(state);
  const requestIdRef = useRef(0);
  const datePickerRequestIdRef = useRef(0);
  const calendarVisibilityBusyRef = useRef(false);
  const calendarVisibilityVersionRef = useRef(0);
  const latestCalendarVisibilityRef = useRef(emptySnapshot.isCalendarVisible);
  const mountedRef = useRef(true);
  const [datePickerState, setDatePickerState] = useState<DatePickerState>({
    month: state.visibleMonth,
    snapshot: emptySnapshot,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
      datePickerRequestIdRef.current += 1;
    };
  }, []);

  const resolveCalendarVisibility = useCallback(
    (snapshot: CalendarSnapshot, requestedVersion: number): CalendarSnapshot => {
      if (requestedVersion === calendarVisibilityVersionRef.current) {
        latestCalendarVisibilityRef.current = snapshot.isCalendarVisible;
        return snapshot;
      }
      return { ...snapshot, isCalendarVisible: latestCalendarVisibilityRef.current };
    },
    [],
  );

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const calendarVisibilityVersion = calendarVisibilityVersionRef.current;
    const target = stateRef.current;
    if (target.status === 'error') {
      setState((current) => ({ ...current, status: 'loading', periodError: null }));
    }
    void loadSnapshot(inputRef.current, target)
      .then((snapshot) => {
        if (!mountedRef.current || requestId !== requestIdRef.current) return;
        setState((current) => ({
          ...current,
          status: 'ready',
          snapshot: resolveCalendarVisibility(snapshot, calendarVisibilityVersion),
          isPeriodLoading: false,
          periodError: null,
        }));
      })
      .catch(() => {
        if (!mountedRef.current || requestId !== requestIdRef.current) return;
        setState((current) => ({
          ...current,
          status: 'error',
          snapshot: emptySnapshot,
          isPeriodLoading: false,
        }));
      });
  }, [
    input.calendars,
    input.events,
    input.holidayProvider,
    input.refreshRevision,
    input.settings,
    input.temporalDefinitions,
    input.weekStartsOn,
    resolveCalendarVisibility,
  ]);

  const transitionTo = useCallback(async (target: ViewTarget): Promise<boolean> => {
    const requestId = ++requestIdRef.current;
    const calendarVisibilityVersion = calendarVisibilityVersionRef.current;
    setState((current) => ({ ...current, isPeriodLoading: true, periodError: null }));
    try {
      const snapshot = await loadSnapshot(inputRef.current, target);
      if (!mountedRef.current || requestId !== requestIdRef.current) return false;
      setState((current) => ({
        ...current,
        ...target,
        status: 'ready',
        snapshot: resolveCalendarVisibility(snapshot, calendarVisibilityVersion),
        isPeriodLoading: false,
        periodError: null,
      }));
      return true;
    } catch {
      if (!mountedRef.current || requestId !== requestIdRef.current) return false;
      setState((current) => ({
        ...current,
        isPeriodLoading: false,
        periodError: '表示期間を読み込めませんでした',
      }));
      return false;
    }
  }, [resolveCalendarVisibility]);

  const selectMode = useCallback(
    async (mode: CalendarViewMode): Promise<boolean> => {
      const current = stateRef.current;
      if (current.mode === mode) return true;
      const target =
        mode === 'month'
          ? {
              ...current,
              mode,
              visibleMonth: getMonthStart(current.selectedDate),
            }
          : {
              ...current,
              mode,
              anchorDate: current.selectedDate,
              visibleMonth: getMonthStart(current.selectedDate),
            };
      return transitionTo(target);
    },
    [transitionTo],
  );

  const movePeriod = useCallback(
    async (offset: -1 | 1): Promise<boolean> => {
      const current = stateRef.current;
      if (current.mode === 'twoDay') {
        const anchorDate = moveTwoDayWindow(current.anchorDate, offset);
        return transitionTo({
          ...current,
          anchorDate,
          selectedDate: anchorDate,
          visibleMonth: getMonthStart(anchorDate),
        });
      }
      const visibleMonth = moveMonth(current.visibleMonth, offset);
      return transitionTo({
        ...current,
        visibleMonth,
        selectedDate: visibleMonth,
        anchorDate: visibleMonth,
      });
    },
    [transitionTo],
  );

  const showPreviousPeriod = useCallback(() => movePeriod(-1), [movePeriod]);
  const showNextPeriod = useCallback(() => movePeriod(1), [movePeriod]);
  const showToday = useCallback(async (): Promise<boolean> => {
    const current = stateRef.current;
    const today = toCalendarDate((inputRef.current.now ?? getSystemTime)());
    return transitionTo({
      ...current,
      today,
      anchorDate: today,
      visibleMonth: getMonthStart(today),
      selectedDate: today,
    });
  }, [transitionTo]);
  const showDate = useCallback(
    (date: string): Promise<boolean> => {
      const current = stateRef.current;
      return transitionTo({
        ...current,
        anchorDate: date,
        visibleMonth: getMonthStart(date),
        selectedDate: date,
      });
    },
    [transitionTo],
  );
  const loadDatePickerMonth = useCallback(async (month: string): Promise<boolean> => {
    const requestId = ++datePickerRequestIdRef.current;
    const calendarVisibilityVersion = calendarVisibilityVersionRef.current;
    setDatePickerState((current) => ({ ...current, isLoading: true, error: null }));
    const current = stateRef.current;
    const target: ViewTarget = {
      ...current,
      mode: 'month',
      visibleMonth: month,
    };
    try {
      const snapshot = await loadSnapshot(inputRef.current, target);
      if (!mountedRef.current || requestId !== datePickerRequestIdRef.current) return false;
      setDatePickerState({
        month,
        snapshot: resolveCalendarVisibility(snapshot, calendarVisibilityVersion),
        isLoading: false,
        error: null,
      });
      return true;
    } catch {
      if (!mountedRef.current || requestId !== datePickerRequestIdRef.current) return false;
      setDatePickerState((value) => ({
        ...value,
        isLoading: false,
        error: '月の予定を読み込めませんでした',
      }));
      return false;
    }
  }, [resolveCalendarVisibility]);
  const selectDate = useCallback(
    async (date: string): Promise<boolean> => {
      const current = stateRef.current;
      const visibleMonth = getMonthStart(date);
      if (current.mode === 'month' && visibleMonth !== current.visibleMonth) {
        return transitionTo({ ...current, visibleMonth, selectedDate: date, anchorDate: date });
      }
      setState((value) => ({ ...value, selectedDate: date }));
      return true;
    },
    [transitionTo],
  );
  const retry = useCallback(
    async (): Promise<boolean> => transitionTo(stateRef.current),
    [transitionTo],
  );

  const setCalendarVisible = useCallback(async (visible: boolean): Promise<boolean> => {
    if (calendarVisibilityBusyRef.current) return false;
    const current = stateRef.current;
    if (current.snapshot.isCalendarVisible === visible) return true;
    calendarVisibilityBusyRef.current = true;
    setState((value) => ({
      ...value,
      isCalendarVisibilityUpdating: true,
      calendarVisibilityError: null,
    }));
    try {
      const now = (inputRef.current.now ?? getSystemTime)().toISOString();
      await inputRef.current.settings.setCalendarVisible(current.snapshot.calendarId, visible, now);
      if (!mountedRef.current) return false;
      latestCalendarVisibilityRef.current = visible;
      calendarVisibilityVersionRef.current += 1;
      setState((value) => ({
        ...value,
        snapshot: { ...value.snapshot, isCalendarVisible: visible },
        calendarVisibilityError: null,
      }));
      setDatePickerState((value) => ({
        ...value,
        snapshot: { ...value.snapshot, isCalendarVisible: visible },
      }));
      return true;
    } catch {
      if (!mountedRef.current) return false;
      setState((value) => ({
        ...value,
        calendarVisibilityError: 'カレンダー表示設定を保存できませんでした',
      }));
      return false;
    } finally {
      calendarVisibilityBusyRef.current = false;
      if (mountedRef.current) {
        setState((value) => ({ ...value, isCalendarVisibilityUpdating: false }));
      }
    }
  }, []);

  const visibleEvents = useMemo(
    () => state.snapshot.isCalendarVisible ? state.snapshot.events : [],
    [state.snapshot.events, state.snapshot.isCalendarVisible],
  );
  const datePickerVisibleEvents = useMemo(
    () => datePickerState.snapshot.isCalendarVisible ? datePickerState.snapshot.events : [],
    [datePickerState.snapshot.events, datePickerState.snapshot.isCalendarVisible],
  );

  const twoDayDays = useMemo(
    () =>
      createTwoDayViewModels({
        range: getTwoDayRange(state.anchorDate),
        today: state.today,
        events: visibleEvents,
        definitions: state.snapshot.definitions,
        undeterminedFadeMinutes: state.snapshot.undeterminedFadeMinutes,
        holidayCoverage: state.snapshot.holidayCoverage,
      }),
    [state.anchorDate, state.snapshot.definitions, state.snapshot.holidayCoverage,
      state.snapshot.undeterminedFadeMinutes, state.today, visibleEvents],
  );
  const twoDayStrip = useMemo(
    () =>
      createTwoDayStripViewModels({
        range: getTwoDayRange(state.anchorDate),
        bufferDays: TWO_DAY_SWIPE_BUFFER_DAYS,
        today: state.today,
        events: visibleEvents,
        definitions: state.snapshot.definitions,
        undeterminedFadeMinutes: state.snapshot.undeterminedFadeMinutes,
        holidayCoverage: state.snapshot.holidayCoverage,
      }),
    [state.anchorDate, state.snapshot.definitions, state.snapshot.holidayCoverage,
      state.snapshot.undeterminedFadeMinutes, state.today, visibleEvents],
  );
  const monthDays = useMemo(
    () =>
      createMonthDayViewModels({
        grid: getMonthGrid(state.visibleMonth, input.weekStartsOn),
        selectedDate: state.selectedDate,
        today: state.today,
        events: visibleEvents,
        holidayCoverage: state.snapshot.holidayCoverage,
      }),
    [input.weekStartsOn, state.selectedDate, state.snapshot.holidayCoverage, state.today,
      state.visibleMonth, visibleEvents],
  );
  const datePickerDays = useMemo(
    () =>
      createMonthDayViewModels({
        grid: getMonthGrid(datePickerState.month, input.weekStartsOn),
        selectedDate: state.selectedDate,
        today: state.today,
        events: datePickerVisibleEvents,
        holidayCoverage: datePickerState.snapshot.holidayCoverage,
      }),
    [datePickerState.month, datePickerState.snapshot.holidayCoverage, datePickerVisibleEvents,
      input.weekStartsOn, state.selectedDate, state.today],
  );
  const selectedAgendaItems = useMemo(
    () =>
      createAgendaItems(
        visibleEvents.filter((event) => occursOnCalendarDate(event, state.selectedDate)),
        new Map(
          [...state.snapshot.definitions.values()]
            .map((definition) => [definition.id, definition.label] as const),
        ),
      ),
    [state.selectedDate, state.snapshot.definitions, visibleEvents],
  );
  const selectedDay =
    state.mode === 'month'
      ? monthDays.find((day) => day.date === state.selectedDate)
      : twoDayDays.find((day) => day.date === state.selectedDate);

  return {
    status: state.status,
    mode: state.mode,
    today: state.today,
    anchorDate: state.anchorDate,
    visibleMonth: state.visibleMonth,
    selectedDate: state.selectedDate,
    twoDayDays,
    twoDayStrip,
    monthDays,
    datePickerMonth: datePickerState.month,
    datePickerDays,
    selectedAgendaItems,
    selectedHolidayName: selectedDay?.holidayName ?? null,
    holidaySupport: selectedDay?.holidaySupport ?? 'unsupported',
    isPeriodLoading: state.isPeriodLoading,
    periodError: state.periodError,
    isDatePickerLoading: datePickerState.isLoading,
    datePickerError: datePickerState.error,
    calendarName: state.snapshot.calendarName,
    calendarColorId: DEFAULT_EVENT_COLOR_ID,
    isCalendarVisible: state.snapshot.isCalendarVisible,
    isCalendarVisibilityUpdating: state.isCalendarVisibilityUpdating,
    calendarVisibilityError: state.calendarVisibilityError,
    selectMode,
    showPreviousPeriod,
    showNextPeriod,
    showToday,
    showDate,
    loadDatePickerMonth,
    selectDate,
    setCalendarVisible,
    retry,
  };
}
