import { loadCalendarSnapshot as loadSnapshot, type CalendarSnapshot, type ViewTarget } from '../calendar-snapshot';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { EventColorId } from '@/constants/event-colors';
import { DEFAULT_CALENDAR_ID } from '@/domain/calendar/calendar';
import {
  DEFAULT_CALENDAR_VIEW_MODE,
  type CalendarViewMode,
} from '@/domain/calendar/calendar-view-mode';
import type { HolidayProvider } from '@/domain/calendar/holiday';
import {
  getMonthGrid,
  getMonthStart,
  getTwoDayRange,
  getWeekRange,
  isCalendarDate,
  moveMonth,
  moveTwoDayWindow,
  offsetCalendarDate,
  toCalendarDate,
} from '@/domain/calendar/month';
import type {
  CalendarRepository,
  EventRepository,
  SettingsRepository,
  TemporalDefinitionRepository,
} from '@/domain/calendar/repositories';
import { DEFAULT_CALENDAR_WEEK_STARTS_ON } from '@/domain/calendar/week-start';
import {
  createAgendaItems,
  occursOnCalendarDate,
  type AgendaItemViewModel,
  type HolidaySupport,
} from '../calendar-view-model';
import { createMonthDayViewModels, createMonthWeekViewModels, type MonthDayViewModel, type MonthWeekViewModel } from '../month-view-model';
import {
  TWO_DAY_SWIPE_BUFFER_DAYS,
  createTwoDayStripViewModels,
  createTwoDayViewModels,
  createDayViewModel,
  type TwoDayViewModel,
} from '../two-day-view-model';

export type CalendarViewStatus = 'loading' | 'ready' | 'error';

export type UseCalendarViewInput = Readonly<{
  calendars: CalendarRepository;
  events: EventRepository;
  settings: SettingsRepository;
  temporalDefinitions: TemporalDefinitionRepository;
  holidayProvider: HolidayProvider;
  refreshRevision?: number;
  now?: () => Date;
  initialDay?: string;
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
  dayStrip: readonly TwoDayViewModel[];
  weekStrip: readonly TwoDayViewModel[];
  monthDays: readonly MonthDayViewModel[];
  monthWeeks: readonly MonthWeekViewModel[];
  datePickerMonth: string;
  datePickerDays: readonly MonthDayViewModel[];
  selectedAgendaItems: readonly AgendaItemViewModel[];
  selectedHolidayName: string | null;
  holidaySupport: HolidaySupport;
  isPeriodLoading: boolean;
  isViewModeUpdating: boolean;
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
  showDay(date: string): Promise<boolean>;
  showPreviousPeriod(): Promise<boolean>;
  showNextPeriod(): Promise<boolean>;
  showToday(): Promise<boolean>;
  showDate(date: string): Promise<boolean>;
  loadDatePickerMonth(month: string): Promise<boolean>;
  selectDate(date: string): Promise<boolean>;
  setCalendarVisible(visible: boolean): Promise<boolean>;
  retry(): Promise<boolean>;
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
  weekStartsOn: DEFAULT_CALENDAR_WEEK_STARTS_ON,
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

export function useCalendarView(input: UseCalendarViewInput): CalendarViewState {
  const inputRef = useRef(input);
  const [isViewModeUpdating, setViewModeUpdating] = useState(false);
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
  const [initialDay] = useState(() => isCalendarDate(input.initialDay) ? input.initialDay : null);
  const modeSelectionBusyRef = useRef(false);
  const modeSelectionVersionRef = useRef(0);
  const datePickerRequestIdRef = useRef(0);
  const datePickerTargetRef = useRef<string | null>(null);
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
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      const today = toCalendarDate((inputRef.current.now ?? getSystemTime)());
      setState((current) => current.today === today ? current : { ...current, today });
    });
    return () => subscription.remove();
  }, []);

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
    const pickerRequestId = ++datePickerRequestIdRef.current;
    const calendarVisibilityVersion = calendarVisibilityVersionRef.current;
    if (stateRef.current.status === 'error') {
      setState((current) => ({ ...current, status: 'loading', periodError: null }));
    }
    void (async () => {
      let target: ViewTarget = stateRef.current;
      if (!initialModeAppliedRef.current) {
        const mode = initialDay === null ? await getInitialMode() : 'day';
        if (!mountedRef.current || requestId !== requestIdRef.current) return;
        target = withViewMode(stateRef.current, mode);
        if (initialDay !== null) target = { ...target, anchorDate: initialDay, selectedDate: initialDay, visibleMonth: getMonthStart(initialDay) };
        initialModeAppliedRef.current = true;
        setState((current) => ({ ...current, ...target }));
      }
      try {
        const snapshot = await loadSnapshot(inputRef.current, target);
        if (!mountedRef.current || requestId !== requestIdRef.current) return;
        setState((current) => ({
          ...current,
          ...target,
          today: toCalendarDate((inputRef.current.now ?? getSystemTime)()),
          status: 'ready',
          snapshot: resolveCalendarVisibility(snapshot, calendarVisibilityVersion),
          isPeriodLoading: false,
          periodError: null,
        }));
        const pickerMonth = datePickerTargetRef.current;
        if (pickerMonth !== null && pickerRequestId === datePickerRequestIdRef.current) {
          setDatePickerState((current) => ({ ...current, isLoading: true, error: null }));
          try {
            const pickerSnapshot = await loadSnapshot(inputRef.current, { ...target, mode: 'month', visibleMonth: pickerMonth });
            if (!mountedRef.current || pickerRequestId !== datePickerRequestIdRef.current) return;
            setDatePickerState({ month: pickerMonth, snapshot: resolveCalendarVisibility(pickerSnapshot, calendarVisibilityVersion), isLoading: false, error: null });
          } catch {
            if (!mountedRef.current || pickerRequestId !== datePickerRequestIdRef.current) return;
            setDatePickerState((current) => ({ ...current, isLoading: false, error: '月の予定を読み込めませんでした' }));
          }
        }
      } catch {
        if (!mountedRef.current || requestId !== requestIdRef.current) return;
        if (datePickerTargetRef.current !== null && pickerRequestId === datePickerRequestIdRef.current) {
          setDatePickerState((current) => ({ ...current, isLoading: false, error: '月の予定を読み込めませんでした' }));
        }
        setState((current) => ({
          ...current,
          status: current.status === 'ready' ? 'ready' : 'error',
          snapshot: current.snapshot,
          isPeriodLoading: false,
          periodError: current.status === 'ready' ? '表示期間を読み込めませんでした' : null,
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
    getInitialMode,
    resolveCalendarVisibility,
    initialDay,
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
        today: toCalendarDate((inputRef.current.now ?? getSystemTime)()),
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
    async (mode: CalendarViewMode, date?: string): Promise<boolean> => {
      if (date !== undefined && !isCalendarDate(date)) return false;
      if (modeSelectionBusyRef.current) return false;
      const current = stateRef.current;
      if (current.mode === mode && date === undefined) return true;
      modeSelectionBusyRef.current = true;
      setViewModeUpdating(true);
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
                anchorDate: date ?? current.selectedDate,
                selectedDate: date ?? current.selectedDate,
                visibleMonth: getMonthStart(date ?? current.selectedDate),
              };
        // 初回URLはすでに対象日のsnapshotを取得済み。再取得に依存せずmode保存へ進む。
        const alreadyDisplayed = current.status === 'ready' && current.mode === mode
          && date !== undefined && current.anchorDate === date && current.selectedDate === date;
        if (!alreadyDisplayed && !(await transitionTo(target))) return false;
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
        if (mountedRef.current) setViewModeUpdating(false);
      }
    },
    [transitionTo],
  );

  const showDay = useCallback((date: string) => selectMode('day', date), [selectMode]);

  const movePeriod = useCallback(
    async (offset: -1 | 1): Promise<boolean> => {
      const current = stateRef.current;
      if (current.mode !== 'month') {
        const anchorDate = current.mode === 'week'
          ? offsetCalendarDate(current.anchorDate, offset * 7)
          : moveTwoDayWindow(current.anchorDate, offset);
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
    datePickerTargetRef.current = month;
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
  const dayStrip = useMemo(() => [-1, 0, 1].map((offset) => createDayViewModel(offsetCalendarDate(state.anchorDate, offset), {
    today: state.today, occurrences: visibleOccurrences, definitions: state.snapshot.definitions,
    undeterminedFadeMinutes: state.snapshot.undeterminedFadeMinutes, calendarColorId: state.snapshot.calendarColorId,
    holidayCoverage: state.snapshot.holidayCoverage,
  })), [state.anchorDate, state.today, state.snapshot, visibleOccurrences]);
  const weekStrip = useMemo(() => {
    if (state.mode !== 'week') return [];
    const range = getWeekRange(state.anchorDate, state.snapshot.weekStartsOn);
    return Array.from({ length: 21 }, (_, index) => createDayViewModel(offsetCalendarDate(range.from, index - 7), {
      ...state.snapshot, today: state.today, occurrences: visibleOccurrences,
    }));
  }, [state.mode, state.anchorDate, state.today, state.snapshot, visibleOccurrences]);
  const monthDays = useMemo(
    () =>
      createMonthDayViewModels({
        grid: getMonthGrid(state.visibleMonth, state.snapshot.weekStartsOn),
        selectedDate: state.selectedDate,
        today: state.today,
        occurrences: visibleOccurrences,
        holidayCoverage: state.snapshot.holidayCoverage,
        definitionLabels: new Map([...state.snapshot.definitions.values()]
          .map((definition) => [definition.id, definition.label] as const)),
      }),
    [state.snapshot.weekStartsOn, state.selectedDate, state.snapshot.definitions,
      state.snapshot.holidayCoverage, state.today, state.visibleMonth, visibleOccurrences],
  );
  const datePickerDays = useMemo(
    () =>
      createMonthDayViewModels({
        grid: getMonthGrid(datePickerState.month, datePickerState.snapshot.weekStartsOn),
        selectedDate: state.selectedDate,
        today: state.today,
        occurrences: datePickerVisibleOccurrences,
        holidayCoverage: datePickerState.snapshot.holidayCoverage,
        definitionLabels: new Map([...datePickerState.snapshot.definitions.values()]
          .map((definition) => [definition.id, definition.label] as const)),
      }),
    [datePickerState.month, datePickerState.snapshot.definitions,
      datePickerState.snapshot.holidayCoverage, datePickerVisibleOccurrences, datePickerState.snapshot.weekStartsOn,
      state.selectedDate, state.today],
  );
  const monthWeeks = useMemo(
    () => createMonthWeekViewModels({
      grid: getMonthGrid(state.visibleMonth, state.snapshot.weekStartsOn),
      occurrences: visibleOccurrences,
      definitionLabels: new Map([...state.snapshot.definitions.values()]
        .map((definition) => [definition.id, definition.label] as const)),
      definitions: state.snapshot.definitions,
      calendarColorId: state.snapshot.calendarColorId,
    }),
    [state.snapshot.weekStartsOn, state.snapshot.calendarColorId, state.snapshot.definitions, state.visibleMonth, visibleOccurrences],
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
      : (state.mode === 'week' ? weekStrip : twoDayDays).find((day) => day.date === state.selectedDate);

  return {
    status: state.status,
    mode: state.mode,
    today: state.today,
    anchorDate: state.anchorDate,
    visibleMonth: state.visibleMonth,
    selectedDate: state.selectedDate,
    twoDayDays,
    twoDayStrip,
    dayStrip,
    weekStrip,
    monthDays,
    monthWeeks,
    datePickerMonth: datePickerState.month,
    datePickerDays,
    selectedAgendaItems,
    selectedHolidayName: selectedDay?.holidayName ?? null,
    holidaySupport: selectedDay?.holidaySupport ?? 'unsupported',
    isPeriodLoading: state.isPeriodLoading,
    isViewModeUpdating,
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
    showDay,
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
