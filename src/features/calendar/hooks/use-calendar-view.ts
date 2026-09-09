import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  selectedAgendaItems: readonly AgendaItemViewModel[];
  selectedHolidayName: string | null;
  holidaySupport: HolidaySupport;
  isPeriodLoading: boolean;
  periodError: string | null;
  selectMode(mode: CalendarViewMode): Promise<boolean>;
  showPreviousPeriod(): Promise<boolean>;
  showNextPeriod(): Promise<boolean>;
  showToday(): Promise<boolean>;
  selectDate(date: string): Promise<boolean>;
  retry(): Promise<boolean>;
}>;

type CalendarSnapshot = Readonly<{
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
  }>;

const emptySnapshot: CalendarSnapshot = {
  events: [],
  holidayCoverage: [],
  definitions: new Map(),
  undeterminedFadeMinutes: 120,
};

function getSystemTime(): Date {
  return new Date();
}

function getTargetRange(target: ViewTarget): Readonly<{ from: string; through: string }> {
  if (target.mode === 'twoDay') {
    const range = getTwoDayRange(target.anchorDate);
    // スワイプ用予備列(前後TWO_DAY_SWIPE_BUFFER_DAYS日)の分だけ広く取得する。
    // 前日側はさらに1日分広げ、日跨ぎ予定が予備列の左端でも継続描画できるようにする。
    return {
      from: offsetCalendarDate(range.from, -(TWO_DAY_SWIPE_BUFFER_DAYS + 1)),
      through: offsetCalendarDate(range.through, TWO_DAY_SWIPE_BUFFER_DAYS),
    };
  }
  return getMonthRange(target.visibleMonth);
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
  const range = getTargetRange(target);
  const events = await input.events.listByAnchorRange(calendar.id, range.from, range.through);
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
  const [definitions, undeterminedFadeMinutes] = await Promise.all([
    Promise.all(fuzzyDefinitionIds.map((id) => input.temporalDefinitions.getById(id))),
    input.settings.getUndeterminedFadeMinutes(),
  ]);

  return {
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
    };
  });
  const stateRef = useRef(state);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

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
    };
  }, []);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
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
          snapshot,
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
  ]);

  const transitionTo = useCallback(async (target: ViewTarget): Promise<boolean> => {
    const requestId = ++requestIdRef.current;
    setState((current) => ({ ...current, isPeriodLoading: true, periodError: null }));
    try {
      const snapshot = await loadSnapshot(inputRef.current, target);
      if (!mountedRef.current || requestId !== requestIdRef.current) return false;
      setState((current) => ({
        ...current,
        ...target,
        status: 'ready',
        snapshot,
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
  }, []);

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

  const twoDayDays = useMemo(
    () =>
      createTwoDayViewModels({
        range: getTwoDayRange(state.anchorDate),
        today: state.today,
        events: state.snapshot.events,
        definitions: state.snapshot.definitions,
        undeterminedFadeMinutes: state.snapshot.undeterminedFadeMinutes,
        holidayCoverage: state.snapshot.holidayCoverage,
      }),
    [state.anchorDate, state.snapshot, state.today],
  );
  const twoDayStrip = useMemo(
    () =>
      createTwoDayStripViewModels({
        range: getTwoDayRange(state.anchorDate),
        bufferDays: TWO_DAY_SWIPE_BUFFER_DAYS,
        today: state.today,
        events: state.snapshot.events,
        definitions: state.snapshot.definitions,
        undeterminedFadeMinutes: state.snapshot.undeterminedFadeMinutes,
        holidayCoverage: state.snapshot.holidayCoverage,
      }),
    [state.anchorDate, state.snapshot, state.today],
  );
  const monthDays = useMemo(
    () =>
      createMonthDayViewModels({
        grid: getMonthGrid(state.visibleMonth, input.weekStartsOn),
        selectedDate: state.selectedDate,
        today: state.today,
        events: state.snapshot.events,
        holidayCoverage: state.snapshot.holidayCoverage,
      }),
    [input.weekStartsOn, state.selectedDate, state.snapshot, state.today, state.visibleMonth],
  );
  const selectedAgendaItems = useMemo(
    () =>
      createAgendaItems(
        state.snapshot.events.filter((event) => event.anchorDate === state.selectedDate),
        new Map(
          [...state.snapshot.definitions.values()]
            .map((definition) => [definition.id, definition.label] as const),
        ),
      ),
    [state.selectedDate, state.snapshot],
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
    selectedAgendaItems,
    selectedHolidayName: selectedDay?.holidayName ?? null,
    holidaySupport: selectedDay?.holidaySupport ?? 'unsupported',
    isPeriodLoading: state.isPeriodLoading,
    periodError: state.periodError,
    selectMode,
    showPreviousPeriod,
    showNextPeriod,
    showToday,
    selectDate,
    retry,
  };
}
