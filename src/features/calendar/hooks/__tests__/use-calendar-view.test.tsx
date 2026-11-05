import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import type { Calendar } from '@/domain/calendar/calendar';
import type { CalendarViewMode } from '@/domain/calendar/calendar-view-mode';
import type { CalendarEvent } from '@/domain/calendar/event';
import type { HolidayProvider } from '@/domain/calendar/holiday';
import type {
  CalendarRepository,
  EventRepository,
  SettingsRepository,
  TemporalDefinitionRepository,
} from '@/domain/calendar/repositories';
import { useCalendarView } from '../use-calendar-view';
import { useCalendarDayRequest } from '../use-calendar-day-request';

const calendar: Calendar = {
  id: 'personal-default',
  name: 'マイカレンダー',
  timeZoneId: 'Asia/Tokyo',
  colorId: 'blue',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const event: CalendarEvent = {
  id: 'event-1',
  calendarId: calendar.id,
  title: '散歩',
  anchorDate: '2026-09-09',
  temporalType: 'fuzzy',
  temporalDefinitionId: 'personal-default:afternoon',
  endDate: '2026-09-09',
  resolutionContext: null,
  location: null,
  noteDocument: null,
  colorId: null,
  recurrenceRule: null,
  createdTimeZoneId: 'Asia/Tokyo',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createDependencies() {
  const calendars: jest.Mocked<CalendarRepository> = {
    getDefault: jest.fn().mockResolvedValue(calendar),
    setColor: jest.fn(),
  };
  const events: jest.Mocked<EventRepository> = {
    create: jest.fn(),
    getById: jest.fn(),
    listByAnchorRange: jest.fn(),
    listSchedule: jest.fn().mockResolvedValue({ events: [event], exceptions: [], replacementEvents: [] }),
    getOccurrenceEditData: jest.fn(),
    saveOccurrenceException: jest.fn(),
    deleteOccurrenceException: jest.fn(),
    applyRecurrenceMutation: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const temporalDefinitions: jest.Mocked<TemporalDefinitionRepository> = {
    listEnabled: jest.fn(),
    getById: jest.fn().mockResolvedValue({
      id: 'personal-default:afternoon',
      calendarId: calendar.id,
      key: 'afternoon',
      label: '午後',
      granularity: 'day',
      resolverConfig: { kind: 'timeOfDay', startMinute: 720, endMinute: 1020 },
      fadeInRatio: 0.2,
      fadeOutRatio: 0.2,
      isSystem: true,
      isEnabled: true,
      sortOrder: 1,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    }),
    disable: jest.fn(),
  };
  const holidayProvider: jest.Mocked<HolidayProvider> = {
    list: jest.fn().mockReturnValue({
      status: 'available',
      holidays: [{ date: '2026-09-09', name: 'テスト祝日' }],
    }),
  };
  const settings: jest.Mocked<SettingsRepository> = {
    getDefaultExactDuration: jest.fn(),
    setDefaultExactDuration: jest.fn(),
    getUndeterminedFadeMinutes: jest.fn().mockResolvedValue(90),
    getCalendarVisible: jest.fn().mockResolvedValue(true),
    setCalendarVisible: jest.fn().mockResolvedValue(undefined),
    getLastEventEditorTab: jest.fn(),
    setLastEventEditorTab: jest.fn(),
    getLastCalendarViewMode: jest.fn().mockResolvedValue('twoDay'),
    getHolidayPreferences: jest.fn().mockResolvedValue({ version: 1, calendarId: 'jp', adjustThisWeekDeadline: false }), setHolidayPreferences: jest.fn().mockResolvedValue(undefined), getCalendarWeekStartsOn: jest.fn().mockResolvedValue(1),
    setCalendarWeekStartsOn: jest.fn().mockResolvedValue(undefined),
    setLastCalendarViewMode: jest.fn().mockResolvedValue(undefined),
    getThisWeekDeadlineWeekday: jest.fn(),
    setThisWeekDeadlineWeekday: jest.fn(),
  };
  return { calendars, events, temporalDefinitions, holidayProvider, settings };
}

describe('カレンダー表示の状態調整', () => {
  beforeEach(() => {
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  });
  it('週を復元し22日分取得して21列を用意し7日ずつ移動する', async () => {
    const dependencies = createDependencies();
    dependencies.settings.getLastCalendarViewMode.mockResolvedValue('week');
    const { result, rerender } = await renderHook(({ revision }: { revision: number }) => useCalendarView({ ...dependencies,
      now: () => new Date(2027, 0, 1, 12), refreshRevision: revision }), { initialProps: { revision: 0 } });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.weekStrip).toHaveLength(21);
    expect(result.current.weekStrip[7].date).toBe('2026-12-28');
    expect(result.current.weekStrip[13].date).toBe('2027-01-03');
    expect(dependencies.events.listSchedule).toHaveBeenCalledWith(calendar.id, '2026-12-20', '2027-01-10');
    await act(async () => { await result.current.showNextPeriod(); });
    expect(result.current.selectedDate).toBe('2027-01-08');
    expect(result.current.weekStrip[7].date).toBe('2027-01-04');
    dependencies.settings.getCalendarWeekStartsOn.mockResolvedValue(0);
    await rerender({ revision: 1 });
    await waitFor(() => expect(result.current.weekStrip[7].date).toBe('2027-01-03'));
    expect(result.current.selectedDate).toBe('2027-01-08');
  });

  it('週の保存失敗では週を維持し、1日切替の取得失敗でも週と選択日を維持する', async () => {
    const dependencies = createDependencies();
    const { result } = await renderHook(() => useCalendarView({ ...dependencies, now: () => new Date(2026, 8, 9, 12) }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    dependencies.settings.setLastCalendarViewMode.mockRejectedValueOnce(new Error('save failed'));
    await act(async () => { expect(await result.current.selectMode('week')).toBe(true); });
    expect(result.current.mode).toBe('week');
    expect(result.current.viewModePersistenceError).not.toBeNull();
    dependencies.events.listSchedule.mockRejectedValueOnce(new Error('load failed'));
    await act(async () => { expect(await result.current.showDay('2026-09-12')).toBe(false); });
    expect(result.current).toMatchObject({ mode: 'week', selectedDate: '2026-09-09' });
  });
  it('初回URLはsnapshotを一度だけ取得し、表示成功後に保存して要求を消費する', async () => {
    const dependencies = createDependencies();
    dependencies.events.listSchedule.mockResolvedValueOnce({ events: [], exceptions: [], replacementEvents: [] })
      .mockRejectedValue(new Error('2回目は失敗する'));
    const clearRequest = jest.fn();
    const { result } = await renderHook(() => {
      const state = useCalendarView({ ...dependencies, initialDay: '2026-12-31', now: () => new Date(2026, 8, 8, 12) });
      useCalendarDayRequest({ day: '2026-12-31', request: 'initial', ready: state.status === 'ready' && !state.isViewModeUpdating,
        isPeriodLoading: state.isPeriodLoading, showDay: state.showDay, clearRequest });
      return state;
    });
    await waitFor(() => expect(clearRequest).toHaveBeenCalledTimes(1));
    expect(dependencies.events.listSchedule).toHaveBeenCalledTimes(1);
    expect(dependencies.settings.setLastCalendarViewMode).toHaveBeenCalledWith('day', expect.any(String));
    expect(result.current.periodError).toBeNull();
  });
  it('別モードの保存中に来たURL要求は保存完了まで待ってから適用する', async () => {
    const dependencies = createDependencies();
    const saved = createDeferred<void>();
    dependencies.settings.getLastCalendarViewMode.mockResolvedValue('month');
    dependencies.settings.setLastCalendarViewMode.mockReturnValueOnce(saved.promise);
    const clearRequest = jest.fn();
    const { result, rerender } = await renderHook(({ day }: { day?: string }) => {
      const state = useCalendarView({ ...dependencies, now: () => new Date(2026, 8, 8, 12) });
      useCalendarDayRequest({ day, request: 'a', ready: state.status === 'ready' && !state.isViewModeUpdating,
        isPeriodLoading: state.isPeriodLoading, showDay: state.showDay, clearRequest });
      return state;
    }, { initialProps: { day: undefined } });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    let switching!: Promise<boolean>;
    await act(async () => { switching = result.current.selectMode('twoDay'); });
    await waitFor(() => expect(result.current.mode).toBe('twoDay'));
    await rerender({ day: '2026-12-31' });
    expect(clearRequest).not.toHaveBeenCalled();
    await act(async () => { saved.resolve(); await switching; });
    await waitFor(() => expect(result.current.anchorDate).toBe('2026-12-31'));
    expect(result.current.mode).toBe('day');
    expect(clearRequest).toHaveBeenCalledTimes(1);
  });
  it('日付をまたいで復帰したら表示日を維持して今日判定だけを更新する', async () => {
    const dependencies = createDependencies();
    dependencies.settings.getLastCalendarViewMode.mockResolvedValue('day');
    let current = new Date(2026, 8, 8, 23, 59);
    let onChange!: (state: AppStateStatus) => void;
    const listener = jest.spyOn(AppState, 'addEventListener').mockImplementation((_, handler) => {
      onChange = handler;
      return { remove: jest.fn() };
    });
    const { result } = await renderHook(() => useCalendarView({ ...dependencies, now: () => current }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const pending = createDeferred<Awaited<ReturnType<EventRepository['listSchedule']>>>();
    dependencies.events.listSchedule.mockReturnValueOnce(pending.promise);
    let moving!: Promise<boolean>;
    await act(async () => { moving = result.current.showNextPeriod(); });
    current = new Date(2026, 8, 9, 0, 1);
    await act(() => onChange('active'));
    expect(result.current.today).toBe('2026-09-09');
    expect(result.current.anchorDate).toBe('2026-09-08');
    expect(result.current.dayStrip[1].isToday).toBe(false);
    await act(async () => { pending.resolve({ events: [], exceptions: [], replacementEvents: [] }); await moving; });
    expect(result.current.today).toBe('2026-09-09');
    expect(result.current.dayStrip[1].isToday).toBe(true);
    listener.mockRestore();
  });
  it('保存済みdayを今日の3列stripとして復元し1日ずつ移動する', async () => {
    const dependencies = createDependencies();
    dependencies.settings.getLastCalendarViewMode.mockResolvedValue('day');
    const { result } = await renderHook(() => useCalendarView({ ...dependencies, now: () => new Date(2026, 8, 30, 12) }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.mode).toBe('day');
    expect(result.current.dayStrip.map((day) => day.date)).toEqual(['2026-09-29', '2026-09-30', '2026-10-01']);
    expect(dependencies.events.listSchedule).toHaveBeenCalledWith(calendar.id, '2026-09-28', '2026-10-01');
    await act(async () => { await result.current.showNextPeriod(); });
    expect(result.current.anchorDate).toBe('2026-10-01');
  });
  it('URLの対象日は保存済みモードより優先して最初のsnapshotから取得する', async () => {
    const dependencies = createDependencies();
    dependencies.settings.getLastCalendarViewMode.mockResolvedValue('month');
    const { result } = await renderHook(() => useCalendarView({ ...dependencies, initialDay: '2026-12-31', now: () => new Date(2026, 8, 8, 12) }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toMatchObject({ mode: 'day', anchorDate: '2026-12-31', selectedDate: '2026-12-31' });
    expect(dependencies.events.listSchedule).toHaveBeenCalledTimes(1);
    expect(dependencies.events.listSchedule).toHaveBeenCalledWith(calendar.id, '2026-12-29', '2027-01-01');
    expect(dependencies.settings.getLastCalendarViewMode).not.toHaveBeenCalled();
    await act(async () => { await result.current.showNextPeriod(); });
    expect(result.current.anchorDate).toBe('2027-01-01');
  });
  it('月の日付からdayへ原子的に切り替え、失敗時は月と選択日を維持する', async () => {
    const dependencies = createDependencies();
    dependencies.settings.getLastCalendarViewMode.mockResolvedValue('month');
    const { result } = await renderHook(() => useCalendarView({ ...dependencies, now: () => new Date(2026, 8, 8, 12) }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    dependencies.events.listSchedule.mockRejectedValueOnce(new Error('failed'));
    await act(async () => { expect(await result.current.showDay('2026-10-01')).toBe(false); });
    expect(result.current.mode).toBe('month');
    expect(result.current.selectedDate).toBe('2026-09-08');
    expect(dependencies.settings.setLastCalendarViewMode).not.toHaveBeenCalled();
    await act(async () => { expect(await result.current.showDay('2026-10-01')).toBe(true); });
    expect(result.current).toMatchObject({ mode: 'day', anchorDate: '2026-10-01', selectedDate: '2026-10-01' });
    expect(dependencies.settings.setLastCalendarViewMode).toHaveBeenCalledWith('day', expect.any(String));
  });
  it('祝日カレンダー無効時は祝日を隠して予定を維持する', async () => {
    const dependencies = createDependencies();
    dependencies.settings.getHolidayPreferences.mockResolvedValue({ version: 1, calendarId: 'none', adjustThisWeekDeadline: false });
    const { result } = await renderHook(() => useCalendarView({ ...dependencies, now: () => new Date(2026, 8, 8, 12) }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.twoDayDays[1].holidayName).toBeNull();
    expect(result.current.twoDayDays[1].timelineItems).toHaveLength(1);
    await act(async () => { await result.current.loadDatePickerMonth('2026-09-01'); });
    expect(result.current.datePickerDays.every((day) => day.holidayName === null)).toBe(true);
    expect(dependencies.holidayProvider.list).not.toHaveBeenCalled();
  });
  it.each([
    [2027, 0, '2026-12-27', '2027-02-06'],
    [2028, 1, '2028-01-30', '2028-03-11'],
  ])('日曜始まりの%s年の月表示を年境界・閏年でも42日分取得する', async (year, month, from, through) => {
    const dependencies = createDependencies();
    dependencies.settings.getCalendarWeekStartsOn.mockResolvedValue(0);
    dependencies.settings.getLastCalendarViewMode.mockResolvedValue('month');
    const { result } = await renderHook(() => useCalendarView({ ...dependencies, now: () => new Date(year, month, 15, 12) }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.monthDays).toHaveLength(42);
    expect(result.current.monthDays[0].date).toBe(from);
    expect(result.current.monthDays[41].date).toBe(through);
    expect(dependencies.events.listSchedule).toHaveBeenCalledWith(calendar.id, from, through);
  });

  it('初回の週開始設定読込失敗はエラーとし、再試行で保存設定を反映する', async () => {
    const dependencies = createDependencies();
    dependencies.settings.getLastCalendarViewMode.mockResolvedValue('month');
    dependencies.settings.getCalendarWeekStartsOn.mockRejectedValueOnce(new Error('failed')).mockResolvedValue(0);
    const { result } = await renderHook(() => useCalendarView({ ...dependencies, now: () => new Date(2026, 8, 8, 12) }));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(dependencies.events.listSchedule).not.toHaveBeenCalled();
    await act(async () => { await result.current.retry(); });
    expect(result.current.status).toBe('ready');
    expect(result.current.monthDays[0].date).toBe('2026-08-30');
  });

  it('refreshの完了前に読み込んだ新しいpickerを待機状態へ戻さない', async () => {
    const dependencies = createDependencies();
    const { result, rerender } = await renderHook(({ revision }: { revision: number }) => useCalendarView({
      ...dependencies, refreshRevision: revision, now: () => new Date(2026, 8, 8, 12),
    }), { initialProps: { revision: 0 } });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { await result.current.loadDatePickerMonth('2026-09-01'); });
    const pending = createDeferred<Awaited<ReturnType<EventRepository['listSchedule']>>>();
    dependencies.events.listSchedule.mockReturnValueOnce(pending.promise);
    await rerender({ revision: 1 });
    await waitFor(() => expect(dependencies.events.listSchedule).toHaveBeenCalledTimes(3));
    await act(async () => { await result.current.loadDatePickerMonth('2026-10-01'); });
    await act(async () => { pending.resolve({ events: [], exceptions: [], replacementEvents: [] }); });
    expect(result.current.datePickerMonth).toBe('2026-10-01');
    expect(result.current.isDatePickerLoading).toBe(false);
  });

  it('設定更新後に古いpicker読込が完了しても新しい曜日順を戻さない', async () => {
    const dependencies = createDependencies();
    const { result, rerender } = await renderHook(({ revision }: { revision: number }) => useCalendarView({
      ...dependencies, refreshRevision: revision, now: () => new Date(2026, 8, 8, 12),
    }), { initialProps: { revision: 0 } });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const pending = createDeferred<Awaited<ReturnType<EventRepository['listSchedule']>>>();
    dependencies.events.listSchedule.mockReturnValueOnce(pending.promise);
    let loading!: Promise<boolean>;
    await act(async () => { loading = result.current.loadDatePickerMonth('2026-09-01'); });
    dependencies.settings.getCalendarWeekStartsOn.mockResolvedValue(0);
    await rerender({ revision: 1 });
    await waitFor(() => expect(result.current.datePickerDays[0].date).toBe('2026-08-30'));
    await act(async () => {
      pending.resolve({ events: [], exceptions: [], replacementEvents: [] });
      await loading;
    });
    expect(result.current.datePickerDays[0].date).toBe('2026-08-30');
    expect(result.current.isDatePickerLoading).toBe(false);
  });

  it('設定更新時の読込失敗でも古いpickerの待機状態を残さない', async () => {
    const dependencies = createDependencies();
    const { result, rerender } = await renderHook(({ revision }: { revision: number }) => useCalendarView({
      ...dependencies, refreshRevision: revision, now: () => new Date(2026, 8, 8, 12),
    }), { initialProps: { revision: 0 } });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const pending = createDeferred<Awaited<ReturnType<EventRepository['listSchedule']>>>();
    dependencies.events.listSchedule.mockReturnValueOnce(pending.promise);
    let loading!: Promise<boolean>;
    await act(async () => { loading = result.current.loadDatePickerMonth('2026-09-01'); });
    dependencies.settings.getCalendarWeekStartsOn.mockRejectedValueOnce(new Error('failed'));
    await rerender({ revision: 1 });
    await waitFor(() => expect(result.current.periodError).not.toBeNull());
    expect(result.current.isDatePickerLoading).toBe(false);
    expect(result.current.datePickerError).not.toBeNull();
    await act(async () => { pending.resolve({ events: [], exceptions: [], replacementEvents: [] }); await loading; });
  });

  it('保存済みの日曜始まりで初回の月範囲とpickerを読み込む', async () => {
    const dependencies = createDependencies();
    dependencies.settings.getCalendarWeekStartsOn.mockResolvedValue(0);
    dependencies.settings.getLastCalendarViewMode.mockResolvedValue('month');
    const { result } = await renderHook(() => useCalendarView({ ...dependencies,
      now: () => new Date(2026, 8, 8, 12) }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.monthDays[0].date).toBe('2026-08-30');
    expect(dependencies.events.listSchedule).toHaveBeenCalledWith(calendar.id, '2026-08-30', '2026-10-10');
    await act(async () => { await result.current.loadDatePickerMonth('2026-09-01'); });
    expect(result.current.datePickerDays[0].date).toBe('2026-08-30');
  });

  it('設定変更の取得失敗では旧表示を維持し、再試行で設定と範囲を同時反映する', async () => {
    const dependencies = createDependencies();
    dependencies.settings.getLastCalendarViewMode.mockResolvedValue('month');
    const { result, rerender } = await renderHook(({ revision }: { revision: number }) => useCalendarView({ ...dependencies,
      refreshRevision: revision, now: () => new Date(2026, 8, 8, 12) }), { initialProps: { revision: 0 } });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    dependencies.settings.getCalendarWeekStartsOn.mockResolvedValue(0);
    dependencies.events.listSchedule.mockRejectedValueOnce(new Error('failed'));
    await rerender({ revision: 1 });
    await waitFor(() => expect(result.current.periodError).not.toBeNull());
    expect(result.current.status).toBe('ready');
    expect(result.current.monthDays[0].date).toBe('2026-08-31');
    await act(async () => { await result.current.retry(); });
    expect(result.current.monthDays[0].date).toBe('2026-08-30');
  });

  it('範囲より前に始まったシリーズを2日・月・選択日へ同じ発生回として表示する', async () => {
    const dependencies = createDependencies();
    const recurringEvent: CalendarEvent = {
      ...event,
      id: 'series-1',
      anchorDate: '2026-09-01',
      endDate: '2026-09-01',
      recurrenceRule: {
        version: 1,
        frequency: 'daily',
        interval: 2,
        weekdays: [],
        end: { type: 'never' },
      },
    };
    dependencies.events.listSchedule.mockResolvedValue({ events: [recurringEvent], exceptions: [], replacementEvents: [] });
    const { result } = await renderHook(() => useCalendarView({
      ...dependencies,
      now: () => new Date(2026, 8, 8, 12),
    }));

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.twoDayDays[1].timelineItems[0]).toMatchObject({
      id: 'series-1:recurrence:2026-09-09',
      eventId: 'series-1',
    });
    expect(result.current.monthDays.find((day) => day.date === '2026-09-09'))
      .toMatchObject({ hasEvents: true });

    await act(async () => expect(await result.current.selectDate('2026-09-09')).toBe(true));
    expect(result.current.selectedAgendaItems[0]).toMatchObject({
      id: 'series-1:recurrence:2026-09-09',
      eventId: 'series-1',
    });
  });

  it('今日と明日の2日表示を初期値にして予定・祝日・時間表現を取得する', async () => {
    const dependencies = createDependencies();
    const { result } = await renderHook(() =>
      useCalendarView({
        ...dependencies,
        now: () => new Date(2026, 8, 8, 12),
      }),
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current).toMatchObject({
      mode: 'twoDay',
      anchorDate: '2026-09-08',
      selectedDate: '2026-09-08',
      visibleMonth: '2026-09-01',
      calendarName: 'マイカレンダー',
      calendarColorId: 'blue',
      isCalendarVisible: true,
      isCalendarVisibilityUpdating: false,
      calendarVisibilityError: null,
    });
    expect(result.current.twoDayDays.map((day) => day.date)).toEqual([
      '2026-09-08',
      '2026-09-09',
    ]);
    expect(result.current.twoDayDays[1]).toMatchObject({
      holidayName: 'テスト祝日',
      timelineItems: [{ title: '散歩', temporalLabel: '午後' }],
    });
    // スワイプ用予備列(既定1日ずつ)の分だけ、表示2日より前後へ広げて取得する。
    // 前日側はさらに、日跨ぎ予定の継続描画のため1日分広げる。
    expect(dependencies.events.listSchedule).toHaveBeenCalledWith(
      calendar.id,
      '2026-09-06',
      '2026-09-10',
    );
    expect(dependencies.settings.getUndeterminedFadeMinutes).toHaveBeenCalledTimes(1);
    expect(dependencies.settings.getCalendarVisible).toHaveBeenCalledWith(calendar.id);
    expect(dependencies.temporalDefinitions.getById).toHaveBeenCalledWith(event.temporalDefinitionId);
  });

  it('保存済み月表示を初回snapshotから直接読み込む', async () => {
    const dependencies = createDependencies();
    dependencies.settings.getLastCalendarViewMode.mockResolvedValue('month');
    const { result } = await renderHook(() => useCalendarView({
      ...dependencies, now: () => new Date(2026, 8, 8, 12),
    }));

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current).toMatchObject({
      mode: 'month', selectedDate: '2026-09-08', visibleMonth: '2026-09-01',
    });
    expect(dependencies.events.listSchedule).toHaveBeenCalledTimes(1);
    expect(dependencies.events.listSchedule).toHaveBeenCalledWith(
      calendar.id, '2026-08-31', '2026-10-11',
    );
  });

  it('表示設定の取得失敗では2日表示を読み込みalertを出さない', async () => {
    const dependencies = createDependencies();
    dependencies.settings.getLastCalendarViewMode.mockRejectedValue(new Error('unavailable'));
    const { result } = await renderHook(() => useCalendarView({
      ...dependencies, now: () => new Date(2026, 8, 8, 12),
    }));

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current).toMatchObject({ mode: 'twoDay', periodError: null });
  });

  it('初期mode取得中のrefreshでも保存済み月表示を一度だけ適用する', async () => {
    const dependencies = createDependencies();
    const mode = createDeferred<CalendarViewMode>();
    dependencies.settings.getLastCalendarViewMode.mockReturnValue(mode.promise);
    const { result, rerender } = await renderHook(
      ({ revision }: { revision: number }) => useCalendarView({
        ...dependencies,
        refreshRevision: revision,
        now: () => new Date(2026, 8, 8, 12),
      }),
      { initialProps: { revision: 0 } },
    );

    await rerender({ revision: 1 });
    await act(async () => mode.resolve('month'));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.mode).toBe('month');
    expect(dependencies.settings.getLastCalendarViewMode).toHaveBeenCalledTimes(1);
    expect(dependencies.events.listSchedule).toHaveBeenLastCalledWith(
      calendar.id, '2026-08-31', '2026-10-11',
    );
  });

  it('初回snapshot失敗後のretryでは復元済みmodeを使い設定を再取得しない', async () => {
    const dependencies = createDependencies();
    dependencies.settings.getLastCalendarViewMode.mockResolvedValue('month');
    dependencies.events.listSchedule
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce({ events: [event], exceptions: [], replacementEvents: [] });
    const { result } = await renderHook(() => useCalendarView({
      ...dependencies, now: () => new Date(2026, 8, 8, 12),
    }));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.mode).toBe('month');
    await act(async () => expect(await result.current.retry()).toBe(true));

    expect(result.current.mode).toBe('month');
    expect(dependencies.settings.getLastCalendarViewMode).toHaveBeenCalledTimes(1);
    expect(dependencies.events.listSchedule).toHaveBeenLastCalledWith(
      calendar.id, '2026-08-31', '2026-10-11',
    );
  });

  it('マイカレンダー非表示では利用者予定だけを隠して祝日を残す', async () => {
    const dependencies = createDependencies();
    dependencies.settings.getCalendarVisible.mockResolvedValue(false);
    const { result } = await renderHook(() =>
      useCalendarView({ ...dependencies, now: () => new Date(2026, 8, 8, 12) }),
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.isCalendarVisible).toBe(false);
    expect(result.current.twoDayDays[1]).toMatchObject({
      holidayName: 'テスト祝日',
      allDayItems: [expect.objectContaining({ kind: 'holiday', title: 'テスト祝日' })],
      timelineItems: [],
    });
    expect(result.current.selectedAgendaItems).toEqual([]);
  });

  it('保存済みのカレンダー色をサイドメニュー用の状態として返す', async () => {
    const dependencies = createDependencies();
    dependencies.calendars.getDefault.mockResolvedValue({ ...calendar, colorId: 'teal' });
    const { result } = await renderHook(() =>
      useCalendarView({ ...dependencies, now: () => new Date(2026, 8, 8, 12) }),
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.calendarColorId).toBe('teal');
  });

  it('マイカレンダー表示設定の保存成功後に予定表示を更新する', async () => {
    const dependencies = createDependencies();
    const { result } = await renderHook(() =>
      useCalendarView({ ...dependencies, now: () => new Date(2026, 8, 8, 12) }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => expect(await result.current.setCalendarVisible(false)).toBe(true));

    expect(dependencies.settings.setCalendarVisible).toHaveBeenCalledWith(
      calendar.id,
      false,
      '2026-09-08T03:00:00.000Z',
    );
    expect(result.current).toMatchObject({
      isCalendarVisible: false,
      isCalendarVisibilityUpdating: false,
      calendarVisibilityError: null,
    });
    expect(result.current.twoDayDays[1].timelineItems).toEqual([]);
  });

  it('マイカレンダー表示設定の保存失敗時は現在表示を維持する', async () => {
    const dependencies = createDependencies();
    dependencies.settings.setCalendarVisible.mockRejectedValue(new Error('database unavailable'));
    const { result } = await renderHook(() =>
      useCalendarView({ ...dependencies, now: () => new Date(2026, 8, 8, 12) }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => expect(await result.current.setCalendarVisible(false)).toBe(false));

    expect(result.current).toMatchObject({
      isCalendarVisible: true,
      isCalendarVisibilityUpdating: false,
      calendarVisibilityError: 'カレンダー表示設定を保存できませんでした',
    });
    expect(result.current.twoDayDays[1].timelineItems).toHaveLength(1);
  });

  it('マイカレンダー表示設定の保存中は同期的に二重実行を防ぐ', async () => {
    const dependencies = createDependencies();
    const pending = createDeferred<void>();
    dependencies.settings.setCalendarVisible.mockReturnValue(pending.promise);
    const { result } = await renderHook(() =>
      useCalendarView({ ...dependencies, now: () => new Date(2026, 8, 8, 12) }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));

    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    await act(async () => {
      first = result.current.setCalendarVisible(false);
      second = result.current.setCalendarVisible(false);
      await Promise.resolve();
    });

    await expect(second).resolves.toBe(false);
    expect(dependencies.settings.setCalendarVisible).toHaveBeenCalledTimes(1);
    expect(result.current.isCalendarVisibilityUpdating).toBe(true);

    await act(async () => pending.resolve(undefined));
    await expect(first).resolves.toBe(true);
    expect(result.current.isCalendarVisibilityUpdating).toBe(false);
  });

  it('期間移動の読込中に非表示へ切り替えても古い表示設定で上書きしない', async () => {
    const dependencies = createDependencies();
    const pendingVisibility = createDeferred<boolean>();
    dependencies.settings.getCalendarVisible
      .mockResolvedValueOnce(true)
      .mockReturnValueOnce(pendingVisibility.promise);
    const { result } = await renderHook(() =>
      useCalendarView({ ...dependencies, now: () => new Date(2026, 8, 8, 12) }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));

    let transition!: Promise<boolean>;
    await act(async () => {
      transition = result.current.showNextPeriod();
      await Promise.resolve();
    });
    await act(async () => expect(await result.current.setCalendarVisible(false)).toBe(true));
    await act(async () => pendingVisibility.resolve(true));

    await expect(transition).resolves.toBe(true);
    expect(result.current.isCalendarVisible).toBe(false);
    expect(result.current.twoDayDays.flatMap((day) => day.timelineItems)).toEqual([]);
  });

  it('日付ピッカーの読込中に非表示へ切り替えても古い表示設定で上書きしない', async () => {
    const dependencies = createDependencies();
    const pendingVisibility = createDeferred<boolean>();
    dependencies.settings.getCalendarVisible
      .mockResolvedValueOnce(true)
      .mockReturnValueOnce(pendingVisibility.promise);
    const { result } = await renderHook(() =>
      useCalendarView({ ...dependencies, now: () => new Date(2026, 8, 8, 12) }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));

    let pickerLoad!: Promise<boolean>;
    await act(async () => {
      pickerLoad = result.current.loadDatePickerMonth('2026-09-01');
      await Promise.resolve();
    });
    await act(async () => expect(await result.current.setCalendarVisible(false)).toBe(true));
    await act(async () => pendingVisibility.resolve(true));

    await expect(pickerLoad).resolves.toBe(true);
    expect(result.current.isCalendarVisible).toBe(false);
    expect(result.current.datePickerDays.find((day) => day.date === event.anchorDate)).toMatchObject({
      hasEvents: false,
    });
  });

  it('2日表示は前後の予備列を含めた4日分のストリップも提供する', async () => {
    const dependencies = createDependencies();
    const { result } = await renderHook(() =>
      useCalendarView({ ...dependencies, now: () => new Date(2026, 8, 8, 12) }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.twoDayStrip.map((day) => day.date)).toEqual([
      '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10',
    ]);
  });

  it('2日表示は前後へ1日単位で移動する', async () => {
    const dependencies = createDependencies();
    const { result } = await renderHook(() =>
      useCalendarView({ ...dependencies, now: () => new Date(2026, 8, 8, 12) }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => expect(await result.current.showNextPeriod()).toBe(true));
    expect(result.current.anchorDate).toBe('2026-09-09');
    await act(async () => expect(await result.current.showPreviousPeriod()).toBe(true));
    expect(result.current.anchorDate).toBe('2026-09-08');
  });

  it('2日表示で選択した任意日を基準日にして表示する', async () => {
    const dependencies = createDependencies();
    const { result } = await renderHook(() =>
      useCalendarView({ ...dependencies, now: () => new Date(2026, 8, 8, 12) }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => expect(await result.current.showDate('2026-09-30')).toBe(true));

    expect(result.current).toMatchObject({
      anchorDate: '2026-09-30',
      visibleMonth: '2026-09-01',
      selectedDate: '2026-09-30',
    });
  });

  it('月表示で選択した任意日の月と選択日を同期する', async () => {
    const dependencies = createDependencies();
    const { result } = await renderHook(() =>
      useCalendarView({ ...dependencies, now: () => new Date(2026, 8, 8, 12) }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => expect(await result.current.selectMode('month')).toBe(true));

    await act(async () => expect(await result.current.showDate('2026-10-15')).toBe(true));

    expect(result.current).toMatchObject({
      anchorDate: '2026-10-15',
      visibleMonth: '2026-10-01',
      selectedDate: '2026-10-15',
    });
  });

  it('任意日の取得に失敗した場合は現在表示を維持する', async () => {
    const dependencies = createDependencies();
    const { result } = await renderHook(() =>
      useCalendarView({ ...dependencies, now: () => new Date(2026, 8, 8, 12) }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    dependencies.events.listSchedule.mockRejectedValueOnce(new Error('database unavailable'));

    await act(async () => expect(await result.current.showDate('2026-10-15')).toBe(false));

    expect(result.current).toMatchObject({
      anchorDate: '2026-09-08',
      visibleMonth: '2026-09-01',
      selectedDate: '2026-09-08',
      periodError: '表示期間を読み込めませんでした',
    });
  });

  it('日付ピッカーは月グリッド42日分の予定を現在表示から独立して取得する', async () => {
    const dependencies = createDependencies();
    const { result } = await renderHook(() =>
      useCalendarView({ ...dependencies, now: () => new Date(2026, 8, 8, 12) }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () =>
      expect(await result.current.loadDatePickerMonth('2026-10-01')).toBe(true));

    expect(result.current.datePickerMonth).toBe('2026-10-01');
    expect(result.current.datePickerDays).toHaveLength(42);
    expect(result.current).toMatchObject({
      anchorDate: '2026-09-08',
      visibleMonth: '2026-09-01',
      datePickerError: null,
      isDatePickerLoading: false,
    });
    expect(dependencies.events.listSchedule).toHaveBeenLastCalledWith(
      calendar.id,
      '2026-09-28',
      '2026-11-08',
    );
  });

  it('日付ピッカーの月取得に失敗しても既存表示を維持する', async () => {
    const dependencies = createDependencies();
    const { result } = await renderHook(() =>
      useCalendarView({ ...dependencies, now: () => new Date(2026, 8, 8, 12) }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    dependencies.events.listSchedule.mockRejectedValueOnce(new Error('database unavailable'));

    await act(async () =>
      expect(await result.current.loadDatePickerMonth('2026-10-01')).toBe(false));

    expect(result.current).toMatchObject({
      anchorDate: '2026-09-08',
      visibleMonth: '2026-09-01',
      datePickerMonth: '2026-09-01',
      datePickerError: '月の予定を読み込めませんでした',
      isDatePickerLoading: false,
    });
  });

  it('月表示と2日表示を選択日を保って切り替える', async () => {
    const dependencies = createDependencies();
    const { result } = await renderHook(() =>
      useCalendarView({ ...dependencies, now: () => new Date(2026, 8, 8, 12) }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => expect(await result.current.selectMode('month')).toBe(true));
    expect(result.current.mode).toBe('month');
    expect(result.current.monthDays).toHaveLength(42);
    expect(dependencies.events.listSchedule).toHaveBeenLastCalledWith(
      calendar.id,
      '2026-08-31',
      '2026-10-11',
    );
    await act(async () => expect(await result.current.selectDate('2026-09-09')).toBe(true));
    await act(async () => expect(await result.current.selectMode('twoDay')).toBe(true));
    expect(result.current).toMatchObject({ mode: 'twoDay', anchorDate: '2026-09-09' });
  });

  it('表示data取得成功後にだけ最後のmodeを保存する', async () => {
    const dependencies = createDependencies();
    const { result } = await renderHook(() => useCalendarView({
      ...dependencies, now: () => new Date(2026, 8, 8, 12),
    }));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => expect(await result.current.selectMode('month')).toBe(true));

    expect(dependencies.settings.setLastCalendarViewMode).toHaveBeenCalledWith(
      'month', '2026-09-08T03:00:00.000Z',
    );
    expect(dependencies.events.listSchedule.mock.invocationCallOrder.at(-1))
      .toBeLessThan(dependencies.settings.setLastCalendarViewMode.mock.invocationCallOrder[0]);
  });

  it('切替先data取得失敗時はmodeと保存設定を変更しない', async () => {
    const dependencies = createDependencies();
    const { result } = await renderHook(() => useCalendarView({
      ...dependencies, now: () => new Date(2026, 8, 8, 12),
    }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    dependencies.events.listSchedule.mockRejectedValueOnce(new Error('unavailable'));

    await act(async () => expect(await result.current.selectMode('month')).toBe(false));

    expect(result.current.mode).toBe('twoDay');
    expect(dependencies.settings.setLastCalendarViewMode).not.toHaveBeenCalled();
  });

  it('mode保存だけ失敗しても月表示を維持して成功を返す', async () => {
    const dependencies = createDependencies();
    dependencies.settings.setLastCalendarViewMode.mockRejectedValue(new Error('unavailable'));
    const { result } = await renderHook(() => useCalendarView({
      ...dependencies, now: () => new Date(2026, 8, 8, 12),
    }));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => expect(await result.current.selectMode('month')).toBe(true));

    expect(result.current).toMatchObject({
      mode: 'month', viewModePersistenceError: '表示設定を保存できませんでした',
    });
  });

  it('保存失敗後に次の切替先data取得も失敗した場合は両方のerrorを維持する', async () => {
    const dependencies = createDependencies();
    dependencies.settings.setLastCalendarViewMode.mockRejectedValueOnce(new Error('unavailable'));
    const { result } = await renderHook(() => useCalendarView({
      ...dependencies, now: () => new Date(2026, 8, 8, 12),
    }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => expect(await result.current.selectMode('month')).toBe(true));
    dependencies.events.listSchedule.mockRejectedValueOnce(new Error('unavailable'));

    await act(async () => expect(await result.current.selectMode('twoDay')).toBe(false));

    expect(result.current).toMatchObject({
      mode: 'month',
      periodError: '表示期間を読み込めませんでした',
      viewModePersistenceError: '表示設定を保存できませんでした',
    });
    expect(dependencies.settings.setLastCalendarViewMode).toHaveBeenCalledTimes(1);
  });

  it('保存失敗後のrefreshでも月表示を維持し初期設定を再取得しない', async () => {
    const dependencies = createDependencies();
    dependencies.settings.getLastCalendarViewMode.mockResolvedValue('twoDay');
    dependencies.settings.setLastCalendarViewMode.mockRejectedValue(new Error('unavailable'));
    const { result, rerender } = await renderHook(
      ({ revision }: { revision: number }) => useCalendarView({
        ...dependencies,
        refreshRevision: revision,
        now: () => new Date(2026, 8, 8, 12),
      }),
      { initialProps: { revision: 0 } },
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => expect(await result.current.selectMode('month')).toBe(true));

    await rerender({ revision: 1 });
    await waitFor(() => expect(dependencies.events.listSchedule).toHaveBeenCalledTimes(3));

    expect(result.current.mode).toBe('month');
    expect(dependencies.settings.getLastCalendarViewMode).toHaveBeenCalledTimes(1);
  });

  it('mode切替中は同期的に二重実行を防ぐ', async () => {
    const dependencies = createDependencies();
    const pending = createDeferred<{ events: CalendarEvent[]; exceptions: []; replacementEvents: [] }>();
    const { result } = await renderHook(() => useCalendarView({
      ...dependencies, now: () => new Date(2026, 8, 8, 12),
    }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    dependencies.events.listSchedule.mockReturnValueOnce(pending.promise);
    let first!: Promise<boolean>;
    let second!: Promise<boolean>;

    await act(async () => {
      first = result.current.selectMode('month');
      second = result.current.selectMode('month');
      await Promise.resolve();
    });

    await expect(second).resolves.toBe(false);
    expect(dependencies.events.listSchedule).toHaveBeenCalledTimes(2);
    expect(dependencies.settings.setLastCalendarViewMode).not.toHaveBeenCalled();
    await act(async () => pending.resolve({ events: [event], exceptions: [], replacementEvents: [] }));
    await expect(first).resolves.toBe(true);
    expect(dependencies.settings.setLastCalendarViewMode).toHaveBeenCalledTimes(1);
  });

  it('unmount後のmode保存失敗ではstateを更新しない', async () => {
    const dependencies = createDependencies();
    const pending = createDeferred<void>();
    dependencies.settings.setLastCalendarViewMode.mockReturnValue(pending.promise);
    const { result, unmount } = await renderHook(() => useCalendarView({
      ...dependencies, now: () => new Date(2026, 8, 8, 12),
    }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    let operation!: Promise<boolean>;
    await act(async () => {
      operation = result.current.selectMode('month');
      await Promise.resolve();
    });
    await waitFor(() => expect(dependencies.settings.setLastCalendarViewMode).toHaveBeenCalled());

    unmount();
    pending.reject(new Error('unavailable'));
    await expect(operation).resolves.toBe(true);
  });

  it('次のmode保存成功で保存errorを消す', async () => {
    const dependencies = createDependencies();
    dependencies.settings.setLastCalendarViewMode
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce(undefined);
    const { result } = await renderHook(() => useCalendarView({
      ...dependencies, now: () => new Date(2026, 8, 8, 12),
    }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => expect(await result.current.selectMode('month')).toBe(true));
    expect(result.current.viewModePersistenceError).not.toBeNull();

    await act(async () => expect(await result.current.selectMode('twoDay')).toBe(true));

    expect(result.current.viewModePersistenceError).toBeNull();
    expect(dependencies.settings.setLastCalendarViewMode.mock.calls.map(([mode]) => mode))
      .toEqual(['month', 'twoDay']);
  });

  it('同じmodeの再選択では再取得も保存もしない', async () => {
    const dependencies = createDependencies();
    const { result } = await renderHook(() => useCalendarView({
      ...dependencies, now: () => new Date(2026, 8, 8, 12),
    }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const snapshotCalls = dependencies.events.listSchedule.mock.calls.length;

    await act(async () => expect(await result.current.selectMode('twoDay')).toBe(true));

    expect(dependencies.events.listSchedule).toHaveBeenCalledTimes(snapshotCalls);
    expect(dependencies.settings.setLastCalendarViewMode).not.toHaveBeenCalled();
  });

  it('期間取得に失敗すると元の期間と表示を維持してエラーを返す', async () => {
    const dependencies = createDependencies();
    const { result } = await renderHook(() =>
      useCalendarView({ ...dependencies, now: () => new Date(2026, 8, 8, 12) }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    dependencies.events.listSchedule.mockRejectedValueOnce(new Error('database unavailable'));

    await act(async () => expect(await result.current.showNextPeriod()).toBe(false));

    expect(result.current).toMatchObject({
      status: 'ready',
      anchorDate: '2026-09-08',
      periodError: '表示期間を読み込めませんでした',
    });
    expect(result.current.twoDayDays.map((day) => day.date)).toEqual([
      '2026-09-08',
      '2026-09-09',
    ]);
  });

  it('今日へ戻し、refreshRevision変更時は現在範囲を再取得する', async () => {
    const dependencies = createDependencies();
    const { result, rerender } = await renderHook(
      ({ revision }: { revision: number }) =>
        useCalendarView({
          ...dependencies,
          refreshRevision: revision,
          now: () => new Date(2026, 8, 8, 12),
        }),
      { initialProps: { revision: 0 } },
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => result.current.showNextPeriod());
    await act(async () => expect(await result.current.showToday()).toBe(true));
    expect(result.current.anchorDate).toBe('2026-09-08');
    const calls = dependencies.events.listSchedule.mock.calls.length;

    await rerender({ revision: 1 });
    await waitFor(() =>
      expect(dependencies.events.listSchedule).toHaveBeenCalledTimes(calls + 1),
    );
  });

  it('古い非同期応答は新しい再取得結果を上書きしない', async () => {
    const dependencies = createDependencies();
    const oldRequest = createDeferred<{ events: CalendarEvent[]; exceptions: []; replacementEvents: [] }>();
    const refreshedEvent = { ...event, id: 'event-refreshed', title: '更新後の予定' };
    dependencies.events.listSchedule
      .mockReturnValueOnce(oldRequest.promise)
      .mockResolvedValueOnce({ events: [refreshedEvent], exceptions: [], replacementEvents: [] });
    const { result, rerender } = await renderHook(
      ({ revision }: { revision: number }) =>
        useCalendarView({
          ...dependencies,
          refreshRevision: revision,
          now: () => new Date(2026, 8, 8, 12),
        }),
      { initialProps: { revision: 0 } },
    );

    await rerender({ revision: 1 });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.twoDayDays[1].timelineItems[0]?.title).toBe('更新後の予定');

    await act(async () => {
      oldRequest.resolve({ events: [event], exceptions: [], replacementEvents: [] });
      await Promise.resolve();
    });
    expect(result.current.twoDayDays[1].timelineItems[0]?.title).toBe('更新後の予定');
  });

  it('期間移動中の再取得が完了すると読み込み中を解除する', async () => {
    const dependencies = createDependencies();
    const transitionRequest = createDeferred<{ events: CalendarEvent[]; exceptions: []; replacementEvents: [] }>();
    const { result, rerender } = await renderHook(
      ({ revision }: { revision: number }) =>
        useCalendarView({
          ...dependencies,
          refreshRevision: revision,
          now: () => new Date(2026, 8, 8, 12),
        }),
      { initialProps: { revision: 0 } },
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    dependencies.events.listSchedule
      .mockReturnValueOnce(transitionRequest.promise)
      .mockResolvedValueOnce({ events: [event], exceptions: [], replacementEvents: [] });
    let transitionResult!: Promise<boolean>;

    await act(async () => {
      transitionResult = result.current.showNextPeriod();
      await Promise.resolve();
    });
    expect(result.current.isPeriodLoading).toBe(true);
    await rerender({ revision: 1 });

    await waitFor(() => expect(result.current.isPeriodLoading).toBe(false));
    expect(result.current.anchorDate).toBe('2026-09-08');
    await act(async () => transitionRequest.resolve({ events: [event], exceptions: [], replacementEvents: [] }));
    await expect(transitionResult).resolves.toBe(false);
  });
});
