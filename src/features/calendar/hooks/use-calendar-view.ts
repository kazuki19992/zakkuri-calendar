import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EventColorId } from '@/constants/event-colors';
import { DEFAULT_CALENDAR_ID } from '@/domain/calendar/calendar';
import {
  DEFAULT_CALENDAR_VIEW_MODE,
  type CalendarViewMode,
} from '@/domain/calendar/calendar-view-mode';
import {
  expandEventOccurrences,
  type EventOccurrence,
} from '@/domain/calendar/event-occurrence';
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
import { createMonthDayViewModels, createMonthWeekViewModels, type MonthDayViewModel, type MonthWeekViewModel } from '../month-view-model';
import {
  TWO_DAY_SWIPE_BUFFER_DAYS,
  createTwoDayStripDates,
  createTwoDayStripViewModels,
  createTwoDayViewModels,
  type TwoDayViewModel,
} from '../two-day-view-model';

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
  monthWeeks: readonly MonthWeekViewModel[];
  datePickerMonth: string;
  datePickerDays: readonly MonthDayViewModel[];
  selectedAgendaItems: readonly AgendaItemViewModel[];
  selectedHolidayName: string | null;
  holidaySupport: HolidaySupport;
  isPeriodLoading: boolean;
  periodError: string | null;
  viewModePersistenceError: string | null;
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
  calendarColorId: EventColorId;
  isCalendarVisible: boolean;
  occurrences: readonly EventOccurrence[];
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
    viewModePersistenceError: string | null;
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
  calendarColorId: 'blue',
  isCalendarVisible: true,
  occurrences: [],
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

function withViewMode(target: ViewTarget, mode: CalendarViewMode): ViewTarget {
  return mode === 'month'
    ? { ...target, mode, visibleMonth: getMonthStart(target.today), selectedDate: target.today }
    : {
        ...target,
        mode,
        anchorDate: target.today,
        visibleMonth: getMonthStart(target.today),
        selectedDate: target.today,
      };
}

async function loadSnapshot(input: UseCalendarViewInput, target: ViewTarget): Promise<CalendarSnapshot> {
  const calendar = await input.calendars.getDefault();
  const range = getTargetRange(target, input.weekStartsOn);
  const [schedule, isCalendarVisible, undeterminedFadeMinutes] = await Promise.all([
    input.events.listSchedule(calendar.id, range.from, range.through),
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

export function useCalendarView(input: UseCalendarViewInput): CalendarViewState {
  const inputRef = useRef(input);
  const [state, setState] = useState<InternalState>(() => {
    const today = toCalendarDate((input.now ?? getSystemTime)());
    return {
      status: 'loading',
      mode: DEFAULT_CALENDAR_VIEW_MODE,
      today,
      anchorDate: today,
      visibleMonth: getMonthStart(today),
      selectedDate: today,
      snapshot: emptySnapshot,
      isPeriodLoading: false,
      periodError: null,
      viewModePersistenceError: null,
      isCalendarVisibilityUpdating: false,
      calendarVisibilityError: null,
    };
  });
  const stateRef = useRef(state);
  const requestIdRef = useRef(0);
  const initialModePromiseRef = useRef<Promise<CalendarViewMode> | null>(null);
  const initialModeAppliedRef = useRef(false);
  const modeSelectionBusyRef = useRef(false);
  const modeSelectionVersionRef = useRef(0);
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
      modeSelectionVersionRef.current += 1;
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

  const getInitialMode = useCallback((): Promise<CalendarViewMode> => {
    initialModePromiseRef.current ??= inputRef.current.settings
      .getLastCalendarViewMode()
      .catch(() => DEFAULT_CALENDAR_VIEW_MODE);
    return initialModePromiseRef.current;
  }, []);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const calendarVisibilityVersion = calendarVisibilityVersionRef.current;
    if (stateRef.current.status === 'error') {
      setState((current) => ({ ...current, status: 'loading', periodError: null }));
    }
    void (async () => {
      let target: ViewTarget = stateRef.current;
      if (!initialModeAppliedRef.current) {
        const mode = await getInitialMode();
        if (!mountedRef.current || requestId !== requestIdRef.current) return;
        target = withViewMode(stateRef.current, mode);
        initialModeAppliedRef.current = true;
        setState((current) => ({ ...current, ...target }));
      }
      try {
        const snapshot = await loadSnapshot(inputRef.current, target);
        if (!mountedRef.current || requestId !== requestIdRef.current) return;
        setState((current) => ({
          ...current,
          ...target,
          status: 'ready',
          snapshot: resolveCalendarVisibility(snapshot, calendarVisibilityVersion),
          isPeriodLoading: false,
          periodError: null,
        }));
      } catch {
        if (!mountedRef.current || requestId !== requestIdRef.current) return;
        setState((current) => ({
          ...current,
          status: 'error',
          snapshot: emptySnapshot,
          isPeriodLoading: false,
        }));
      }
    })();
  }, [
    input.calendars,
    input.events,
    input.holidayProvider,
    input.refreshRevision,
    input.settings,
    input.temporalDefinitions,
    input.weekStartsOn,
    getInitialMode,
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
      if (modeSelectionBusyRef.current) return false;
      const current = stateRef.current;
      if (current.mode === mode) return true;
      modeSelectionBusyRef.current = true;
      const operationVersion = ++modeSelectionVersionRef.current;
      try {
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
        if (!(await transitionTo(target))) return false;
        setState((value) => ({ ...value, viewModePersistenceError: null }));
        try {
          const now = (inputRef.current.now ?? getSystemTime)().toISOString();
          await inputRef.current.settings.setLastCalendarViewMode(mode, now);
          if (mountedRef.current && operationVersion === modeSelectionVersionRef.current) {
            setState((value) => ({ ...value, viewModePersistenceError: null }));
          }
        } catch {
          if (mountedRef.current && operationVersion === modeSelectionVersionRef.current) {
            setState((value) => ({
              ...value,
              viewModePersistenceError: '表示設定を保存できませんでした',
            }));
          }
        }
        return true;
      } finally {
        modeSelectionBusyRef.current = false;
      }
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

  const visibleOccurrences = useMemo(
    () => state.snapshot.isCalendarVisible ? state.snapshot.occurrences : [],
    [state.snapshot.occurrences, state.snapshot.isCalendarVisible],
  );
  const datePickerVisibleOccurrences = useMemo(
    () => datePickerState.snapshot.isCalendarVisible ? datePickerState.snapshot.occurrences : [],
    [datePickerState.snapshot.occurrences, datePickerState.snapshot.isCalendarVisible],
  );

  const twoDayDays = useMemo(
    () =>
      createTwoDayViewModels({
        range: getTwoDayRange(state.anchorDate),
        today: state.today,
        occurrences: visibleOccurrences,
        definitions: state.snapshot.definitions,
        undeterminedFadeMinutes: state.snapshot.undeterminedFadeMinutes,
        calendarColorId: state.snapshot.calendarColorId,
        holidayCoverage: state.snapshot.holidayCoverage,
      }),
    [state.anchorDate, state.snapshot.calendarColorId, state.snapshot.definitions, state.snapshot.holidayCoverage,
      state.snapshot.undeterminedFadeMinutes, state.today, visibleOccurrences],
  );
  const twoDayStrip = useMemo(
    () =>
      createTwoDayStripViewModels({
        range: getTwoDayRange(state.anchorDate),
        bufferDays: TWO_DAY_SWIPE_BUFFER_DAYS,
        today: state.today,
        occurrences: visibleOccurrences,
        definitions: state.snapshot.definitions,
        undeterminedFadeMinutes: state.snapshot.undeterminedFadeMinutes,
        calendarColorId: state.snapshot.calendarColorId,
        holidayCoverage: state.snapshot.holidayCoverage,
      }),
    [state.anchorDate, state.snapshot.calendarColorId, state.snapshot.definitions, state.snapshot.holidayCoverage,
      state.snapshot.undeterminedFadeMinutes, state.today, visibleOccurrences],
  );
  const monthDays = useMemo(
    () =>
      createMonthDayViewModels({
        grid: getMonthGrid(state.visibleMonth, input.weekStartsOn),
        selectedDate: state.selectedDate,
        today: state.today,
        occurrences: visibleOccurrences,
        holidayCoverage: state.snapshot.holidayCoverage,
        definitionLabels: new Map([...state.snapshot.definitions.values()]
          .map((definition) => [definition.id, definition.label] as const)),
      }),
    [input.weekStartsOn, state.selectedDate, state.snapshot.definitions,
      state.snapshot.holidayCoverage, state.today, state.visibleMonth, visibleOccurrences],
  );
  const datePickerDays = useMemo(
    () =>
      createMonthDayViewModels({
        grid: getMonthGrid(datePickerState.month, input.weekStartsOn),
        selectedDate: state.selectedDate,
        today: state.today,
        occurrences: datePickerVisibleOccurrences,
        holidayCoverage: datePickerState.snapshot.holidayCoverage,
        definitionLabels: new Map([...datePickerState.snapshot.definitions.values()]
          .map((definition) => [definition.id, definition.label] as const)),
      }),
    [datePickerState.month, datePickerState.snapshot.definitions,
      datePickerState.snapshot.holidayCoverage, datePickerVisibleOccurrences, input.weekStartsOn,
      state.selectedDate, state.today],
  );
  const monthWeeks = useMemo(
    () => createMonthWeekViewModels({
      grid: getMonthGrid(state.visibleMonth, input.weekStartsOn),
      occurrences: visibleOccurrences,
      definitionLabels: new Map([...state.snapshot.definitions.values()]
        .map((definition) => [definition.id, definition.label] as const)),
      definitions: state.snapshot.definitions,
      calendarColorId: state.snapshot.calendarColorId,
    }),
    [input.weekStartsOn, state.snapshot.calendarColorId, state.snapshot.definitions, state.visibleMonth, visibleOccurrences],
  );
  const selectedAgendaItems = useMemo(
    () =>
      createAgendaItems(
        visibleOccurrences.filter((occurrence) =>
          occursOnCalendarDate(occurrence, state.selectedDate)),
        new Map(
          [...state.snapshot.definitions.values()]
            .map((definition) => [definition.id, definition.label] as const),
        ),
      ),
    [state.selectedDate, state.snapshot.definitions, visibleOccurrences],
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
    monthWeeks,
    datePickerMonth: datePickerState.month,
    datePickerDays,
    selectedAgendaItems,
    selectedHolidayName: selectedDay?.holidayName ?? null,
    holidaySupport: selectedDay?.holidaySupport ?? 'unsupported',
    isPeriodLoading: state.isPeriodLoading,
    periodError: state.periodError,
    viewModePersistenceError: state.viewModePersistenceError,
    isDatePickerLoading: datePickerState.isLoading,
    datePickerError: datePickerState.error,
    calendarName: state.snapshot.calendarName,
    calendarColorId: state.snapshot.calendarColorId,
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
