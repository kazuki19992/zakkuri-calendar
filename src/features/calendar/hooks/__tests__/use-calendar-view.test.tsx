import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { Calendar } from '@/domain/calendar/calendar';
import type { CalendarEvent } from '@/domain/calendar/event';
import type { HolidayProvider } from '@/domain/calendar/holiday';
import type {
  CalendarRepository,
  EventRepository,
  SettingsRepository,
  TemporalDefinitionRepository,
} from '@/domain/calendar/repositories';
import { useCalendarView } from '../use-calendar-view';

const calendar: Calendar = {
  id: 'personal-default',
  name: 'マイカレンダー',
  timeZoneId: 'Asia/Tokyo',
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
  createdTimeZoneId: 'Asia/Tokyo',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createDependencies() {
  const calendars: jest.Mocked<CalendarRepository> = {
    getDefault: jest.fn().mockResolvedValue(calendar),
  };
  const events: jest.Mocked<EventRepository> = {
    create: jest.fn(),
    getById: jest.fn(),
    listByAnchorRange: jest.fn().mockResolvedValue([event]),
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
  };
  return { calendars, events, temporalDefinitions, holidayProvider, settings };
}

describe('カレンダー表示の状態調整', () => {
  it('今日と明日の2日表示を初期値にして予定・祝日・時間表現を取得する', async () => {
    const dependencies = createDependencies();
    const { result } = await renderHook(() =>
      useCalendarView({
        ...dependencies,
        weekStartsOn: 1,
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
    expect(dependencies.events.listByAnchorRange).toHaveBeenCalledWith(
      calendar.id,
      '2026-09-06',
      '2026-09-10',
    );
    expect(dependencies.settings.getUndeterminedFadeMinutes).toHaveBeenCalledTimes(1);
    expect(dependencies.settings.getCalendarVisible).toHaveBeenCalledWith(calendar.id);
    expect(dependencies.temporalDefinitions.getById).toHaveBeenCalledWith(event.temporalDefinitionId);
  });

  it('マイカレンダー非表示では利用者予定だけを隠して祝日を残す', async () => {
    const dependencies = createDependencies();
    dependencies.settings.getCalendarVisible.mockResolvedValue(false);
    const { result } = await renderHook(() =>
      useCalendarView({ ...dependencies, weekStartsOn: 1, now: () => new Date(2026, 8, 8, 12) }),
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

  it('マイカレンダー表示設定の保存成功後に予定表示を更新する', async () => {
    const dependencies = createDependencies();
    const { result } = await renderHook(() =>
      useCalendarView({ ...dependencies, weekStartsOn: 1, now: () => new Date(2026, 8, 8, 12) }),
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
      useCalendarView({ ...dependencies, weekStartsOn: 1, now: () => new Date(2026, 8, 8, 12) }),
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
      useCalendarView({ ...dependencies, weekStartsOn: 1, now: () => new Date(2026, 8, 8, 12) }),
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

  it('2日表示は前後の予備列を含めた4日分のストリップも提供する', async () => {
    const dependencies = createDependencies();
    const { result } = await renderHook(() =>
      useCalendarView({ ...dependencies, weekStartsOn: 1, now: () => new Date(2026, 8, 8, 12) }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.twoDayStrip.map((day) => day.date)).toEqual([
      '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10',
    ]);
  });

  it('2日表示は前後へ1日単位で移動する', async () => {
    const dependencies = createDependencies();
    const { result } = await renderHook(() =>
      useCalendarView({ ...dependencies, weekStartsOn: 1, now: () => new Date(2026, 8, 8, 12) }),
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
      useCalendarView({ ...dependencies, weekStartsOn: 1, now: () => new Date(2026, 8, 8, 12) }),
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
      useCalendarView({ ...dependencies, weekStartsOn: 1, now: () => new Date(2026, 8, 8, 12) }),
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
      useCalendarView({ ...dependencies, weekStartsOn: 1, now: () => new Date(2026, 8, 8, 12) }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    dependencies.events.listByAnchorRange.mockRejectedValueOnce(new Error('database unavailable'));

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
      useCalendarView({ ...dependencies, weekStartsOn: 1, now: () => new Date(2026, 8, 8, 12) }),
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
    expect(dependencies.events.listByAnchorRange).toHaveBeenLastCalledWith(
      calendar.id,
      '2026-09-28',
      '2026-11-08',
    );
  });

  it('日付ピッカーの月取得に失敗しても既存表示を維持する', async () => {
    const dependencies = createDependencies();
    const { result } = await renderHook(() =>
      useCalendarView({ ...dependencies, weekStartsOn: 1, now: () => new Date(2026, 8, 8, 12) }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    dependencies.events.listByAnchorRange.mockRejectedValueOnce(new Error('database unavailable'));

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
      useCalendarView({ ...dependencies, weekStartsOn: 1, now: () => new Date(2026, 8, 8, 12) }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => expect(await result.current.selectMode('month')).toBe(true));
    expect(result.current.mode).toBe('month');
    expect(result.current.monthDays).toHaveLength(42);
    expect(dependencies.events.listByAnchorRange).toHaveBeenLastCalledWith(
      calendar.id,
      '2026-08-31',
      '2026-10-11',
    );
    await act(async () => expect(await result.current.selectDate('2026-09-09')).toBe(true));
    await act(async () => expect(await result.current.selectMode('twoDay')).toBe(true));
    expect(result.current).toMatchObject({ mode: 'twoDay', anchorDate: '2026-09-09' });
  });

  it('期間取得に失敗すると元の期間と表示を維持してエラーを返す', async () => {
    const dependencies = createDependencies();
    const { result } = await renderHook(() =>
      useCalendarView({ ...dependencies, weekStartsOn: 1, now: () => new Date(2026, 8, 8, 12) }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    dependencies.events.listByAnchorRange.mockRejectedValueOnce(new Error('database unavailable'));

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
          weekStartsOn: 1,
          refreshRevision: revision,
          now: () => new Date(2026, 8, 8, 12),
        }),
      { initialProps: { revision: 0 } },
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => result.current.showNextPeriod());
    await act(async () => expect(await result.current.showToday()).toBe(true));
    expect(result.current.anchorDate).toBe('2026-09-08');
    const calls = dependencies.events.listByAnchorRange.mock.calls.length;

    await rerender({ revision: 1 });
    await waitFor(() =>
      expect(dependencies.events.listByAnchorRange).toHaveBeenCalledTimes(calls + 1),
    );
  });

  it('古い非同期応答は新しい再取得結果を上書きしない', async () => {
    const dependencies = createDependencies();
    const oldRequest = createDeferred<CalendarEvent[]>();
    const refreshedEvent = { ...event, id: 'event-refreshed', title: '更新後の予定' };
    dependencies.events.listByAnchorRange
      .mockReturnValueOnce(oldRequest.promise)
      .mockResolvedValueOnce([refreshedEvent]);
    const { result, rerender } = await renderHook(
      ({ revision }: { revision: number }) =>
        useCalendarView({
          ...dependencies,
          weekStartsOn: 1,
          refreshRevision: revision,
          now: () => new Date(2026, 8, 8, 12),
        }),
      { initialProps: { revision: 0 } },
    );

    await rerender({ revision: 1 });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.twoDayDays[1].timelineItems[0]?.title).toBe('更新後の予定');

    await act(async () => {
      oldRequest.resolve([event]);
      await Promise.resolve();
    });
    expect(result.current.twoDayDays[1].timelineItems[0]?.title).toBe('更新後の予定');
  });

  it('期間移動中の再取得が完了すると読み込み中を解除する', async () => {
    const dependencies = createDependencies();
    const transitionRequest = createDeferred<CalendarEvent[]>();
    const { result, rerender } = await renderHook(
      ({ revision }: { revision: number }) =>
        useCalendarView({
          ...dependencies,
          weekStartsOn: 1,
          refreshRevision: revision,
          now: () => new Date(2026, 8, 8, 12),
        }),
      { initialProps: { revision: 0 } },
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    dependencies.events.listByAnchorRange
      .mockReturnValueOnce(transitionRequest.promise)
      .mockResolvedValueOnce([event]);
    let transitionResult!: Promise<boolean>;

    await act(async () => {
      transitionResult = result.current.showNextPeriod();
      await Promise.resolve();
    });
    expect(result.current.isPeriodLoading).toBe(true);
    await rerender({ revision: 1 });

    await waitFor(() => expect(result.current.isPeriodLoading).toBe(false));
    expect(result.current.anchorDate).toBe('2026-09-08');
    await act(async () => transitionRequest.resolve([event]));
    await expect(transitionResult).resolves.toBe(false);
  });
});
