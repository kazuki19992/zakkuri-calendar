import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { Calendar } from '@/domain/calendar/calendar';
import type { CalendarEvent } from '@/domain/calendar/event';
import type { HolidayProvider } from '@/domain/calendar/holiday';
import type {
  CalendarRepository,
  EventRepository,
  TemporalDefinitionRepository,
} from '@/domain/calendar/repositories';
import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';
import { useMonthCalendar, type MonthCalendarState } from '../use-month-calendar';

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
  title: '歯医者',
  temporalType: 'exact',
  anchorDate: '2026-09-08',
  startTime: '14:30',
  duration: { type: 'fixed', minutes: 30 },
  createdTimeZoneId: 'Asia/Tokyo',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const fuzzyEvent: CalendarEvent = {
  ...event,
  id: 'fuzzy-event-1',
  title: '散歩',
  temporalType: 'fuzzy',
  temporalDefinitionId: 'personal-default:afternoon',
};

const disabledDefinition: TemporalDefinition = {
  id: 'personal-default:afternoon',
  calendarId: calendar.id,
  key: 'afternoon',
  label: '午後',
  granularity: 'day',
  resolverConfig: { kind: 'timeOfDay', startMinute: 720, endMinute: 1020 },
  fadeInRatio: 0.2,
  fadeOutRatio: 0.2,
  isSystem: true,
  isEnabled: false,
  sortOrder: 1,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

type RepositoryDoubles = Readonly<{
  calendars: jest.Mocked<CalendarRepository>;
  events: jest.Mocked<EventRepository>;
  temporalDefinitions: jest.Mocked<TemporalDefinitionRepository>;
}>;

function createDeferred<T>(): Readonly<{
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
}> {
  let resolvePromise!: (value: T) => void;
  let rejectPromise!: (reason: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

function createRepositories(eventsInMonth: readonly CalendarEvent[] = [event]): RepositoryDoubles {
  return {
    calendars: {
      getDefault: jest.fn().mockResolvedValue(calendar),
    },
    events: {
      create: jest.fn(),
      getById: jest.fn(),
      listByAnchorRange: jest.fn().mockResolvedValue([...eventsInMonth]),
      update: jest.fn(),
      delete: jest.fn(),
    },
    temporalDefinitions: {
      listEnabled: jest.fn().mockResolvedValue([]),
      getById: jest.fn().mockResolvedValue(null),
      disable: jest.fn(),
    },
  };
}

function createHolidayProvider(): jest.Mocked<HolidayProvider> {
  return {
    list: jest.fn().mockReturnValue({
      status: 'available',
      holidays: [{ date: '2026-09-21', name: '敬老の日' }],
    }),
  };
}

describe('月カレンダーの状態調整', () => {
  it('今日を選択して当月の予定と祝日を読み込む', async () => {
    const repositories = createRepositories();
    const holidayProvider = createHolidayProvider();

    const { result } = await renderHook(() =>
      useMonthCalendar({
        ...repositories,
        holidayProvider,
        weekStartsOn: 1,
        now: () => new Date(2026, 8, 8, 12),
      }),
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current).toMatchObject({
      visibleMonth: '2026-09-01',
      selectedDate: '2026-09-08',
      today: '2026-09-08',
      selectedHolidayName: null,
      holidaySupport: 'available',
      agendaItems: [
        {
          id: 'event-1',
          title: '歯医者',
          temporalLabel: '14:30',
          accessibilityLabel: '歯医者、14:30',
        },
      ],
    });
    expect(result.current.days).toHaveLength(42);
    expect(result.current.days.find((day) => day.date === '2026-09-08')).toMatchObject({
      isToday: true,
      isSelected: true,
      hasEvents: true,
    });
    expect(result.current.days.find((day) => day.date === '2026-09-21')).toMatchObject({
      holidayName: '敬老の日',
    });
    expect(repositories.events.listByAnchorRange).toHaveBeenCalledWith(
      'personal-default',
      '2026-09-01',
      '2026-09-30',
    );
    expect(holidayProvider.list).toHaveBeenCalledWith('2026-09-01', '2026-09-30');
  });

  it('次月へ移動すると月初を選択して移動先の予定を読み込む', async () => {
    const repositories = createRepositories([]);
    const holidayProvider = createHolidayProvider();
    const october = createDeferred<CalendarEvent[]>();
    const octoberEvent: CalendarEvent = {
      ...event,
      id: 'event-october',
      title: '衣替え',
      anchorDate: '2026-10-01',
    };
    repositories.events.listByAnchorRange
      .mockResolvedValueOnce([event])
      .mockReturnValueOnce(october.promise);
    const { result } = await renderHook(() =>
      useMonthCalendar({
        ...repositories,
        holidayProvider,
        weekStartsOn: 1,
        now: () => new Date(2026, 8, 8, 12),
      }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(() => {
      result.current.showNextMonth();
    });
    expect(result.current.status).toBe('loading');
    expect(result.current.agendaItems).toEqual([]);
    await act(() => {
      october.resolve([octoberEvent]);
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.visibleMonth).toBe('2026-10-01');
    expect(result.current.selectedDate).toBe('2026-10-01');
    expect(result.current.agendaItems).toEqual([
      expect.objectContaining({ id: 'event-october', title: '衣替え' }),
    ]);
    expect(repositories.events.listByAnchorRange).toHaveBeenLastCalledWith(
      calendar.id,
      '2026-10-01',
      '2026-10-31',
    );
  });

  it('前後月の日付を選ぶと表示月も選択日に追従する', async () => {
    const repositories = createRepositories([]);
    const holidayProvider = createHolidayProvider();
    const { result } = await renderHook(() =>
      useMonthCalendar({
        ...repositories,
        holidayProvider,
        weekStartsOn: 1,
        now: () => new Date(2026, 8, 8, 12),
      }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(() => {
      result.current.selectDate('2026-08-31');
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toMatchObject({
      visibleMonth: '2026-08-01',
      selectedDate: '2026-08-31',
    });

    await act(() => {
      result.current.selectDate('2026-09-06');
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toMatchObject({
      visibleMonth: '2026-09-01',
      selectedDate: '2026-09-06',
    });
  });

  it('今日へ戻すと表示月と選択日を現在日に戻す', async () => {
    const repositories = createRepositories([]);
    const holidayProvider = createHolidayProvider();
    const { result } = await renderHook(() =>
      useMonthCalendar({
        ...repositories,
        holidayProvider,
        weekStartsOn: 1,
        now: () => new Date(2026, 8, 8, 12),
      }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(() => {
      result.current.showNextMonth();
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(() => {
      result.current.showToday();
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.visibleMonth).toBe('2026-09-01');
    expect(result.current.selectedDate).toBe('2026-09-08');
  });

  it('読み込み失敗後に同じ月を再試行する', async () => {
    const repositories = createRepositories([]);
    const holidayProvider = createHolidayProvider();
    repositories.events.listByAnchorRange
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce([event]);
    const { result } = await renderHook(() =>
      useMonthCalendar({
        ...repositories,
        holidayProvider,
        weekStartsOn: 1,
        now: () => new Date(2026, 8, 8, 12),
      }),
    );
    await waitFor(() => expect(result.current.status).toBe('error'));

    expect(result.current.agendaItems).toEqual([]);
    await act(() => {
      result.current.retry();
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.agendaItems).toEqual([
      expect.objectContaining({ id: 'event-1', title: '歯医者' }),
    ]);
    expect(repositories.events.listByAnchorRange).toHaveBeenCalledTimes(2);
  });

  it('古い月の遅い応答で現在月の状態を上書きしない', async () => {
    const repositories = createRepositories([]);
    const holidayProvider = createHolidayProvider();
    const september = createDeferred<CalendarEvent[]>();
    const octoberEvent: CalendarEvent = {
      ...event,
      id: 'event-october',
      title: '衣替え',
      anchorDate: '2026-10-01',
    };
    repositories.events.listByAnchorRange
      .mockReturnValueOnce(september.promise)
      .mockResolvedValueOnce([octoberEvent]);
    const { result } = await renderHook(() =>
      useMonthCalendar({
        ...repositories,
        holidayProvider,
        weekStartsOn: 1,
        now: () => new Date(2026, 8, 8, 12),
      }),
    );

    await act(() => {
      result.current.showNextMonth();
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(() => {
      september.resolve([event]);
    });

    expect(result.current.visibleMonth).toBe('2026-10-01');
    expect(result.current.agendaItems).toEqual([
      expect.objectContaining({ id: 'event-october', title: '衣替え' }),
    ]);
  });

  it.each([
    ['次月への移動', (state: MonthCalendarState) => state.showNextMonth()],
    ['別月の日付選択', (state: MonthCalendarState) => state.selectDate('2026-10-02')],
    ['再試行', (state: MonthCalendarState) => state.retry()],
  ])('%sの直後に旧応答が完了しても読み込み中を維持する', async (_operation, startLoad) => {
    const repositories = createRepositories([]);
    const holidayProvider = createHolidayProvider();
    const oldRequest = createDeferred<CalendarEvent[]>();
    const currentRequest = createDeferred<CalendarEvent[]>();
    repositories.events.listByAnchorRange
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(currentRequest.promise);
    const { result, unmount } = await renderHook(() =>
      useMonthCalendar({
        ...repositories,
        holidayProvider,
        weekStartsOn: 1,
        now: () => new Date(2026, 8, 8, 12),
      }),
    );

    await act(async () => {
      startLoad(result.current);
      oldRequest.resolve([event]);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.status).toBe('loading');
    expect(holidayProvider.list).not.toHaveBeenCalled();
    await unmount();
  });

  it('今日へ戻す直後に旧月の応答が完了しても読み込み中を維持する', async () => {
    const repositories = createRepositories([]);
    const holidayProvider = createHolidayProvider();
    const octoberRequest = createDeferred<CalendarEvent[]>();
    const septemberRequest = createDeferred<CalendarEvent[]>();
    repositories.events.listByAnchorRange
      .mockResolvedValueOnce([])
      .mockReturnValueOnce(octoberRequest.promise)
      .mockReturnValueOnce(septemberRequest.promise);
    const { result, unmount } = await renderHook(() =>
      useMonthCalendar({
        ...repositories,
        holidayProvider,
        weekStartsOn: 1,
        now: () => new Date(2026, 8, 8, 12),
      }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(() => {
      result.current.showNextMonth();
    });
    holidayProvider.list.mockClear();

    await act(async () => {
      result.current.showToday();
      octoberRequest.resolve([event]);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current).toMatchObject({
      status: 'loading',
      visibleMonth: '2026-09-01',
      selectedDate: '2026-09-08',
    });
    expect(holidayProvider.list).not.toHaveBeenCalled();
    await unmount();
  });

  it('ざっくり定義IDを重複排除して無効化済み定義も解決する', async () => {
    const repositories = createRepositories([
      fuzzyEvent,
      { ...fuzzyEvent, id: 'fuzzy-event-2', title: '読書' },
    ]);
    repositories.temporalDefinitions.getById.mockResolvedValue(disabledDefinition);
    const holidayProvider = createHolidayProvider();
    const { result } = await renderHook(() =>
      useMonthCalendar({
        ...repositories,
        holidayProvider,
        weekStartsOn: 1,
        now: () => new Date(2026, 8, 8, 12),
      }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.agendaItems).toEqual([
      expect.objectContaining({ id: 'fuzzy-event-1', temporalLabel: '午後' }),
      expect.objectContaining({ id: 'fuzzy-event-2', temporalLabel: '午後' }),
    ]);
    expect(repositories.temporalDefinitions.getById).toHaveBeenCalledTimes(1);
    expect(repositories.temporalDefinitions.getById).toHaveBeenCalledWith(
      'personal-default:afternoon',
    );
    expect(repositories.temporalDefinitions.listEnabled).not.toHaveBeenCalled();
  });

  it('エラー状態から別の月へ移動して操作を継続できる', async () => {
    const repositories = createRepositories([]);
    const holidayProvider = createHolidayProvider();
    repositories.events.listByAnchorRange
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce([]);
    const { result } = await renderHook(() =>
      useMonthCalendar({
        ...repositories,
        holidayProvider,
        weekStartsOn: 1,
        now: () => new Date(2026, 8, 8, 12),
      }),
    );
    await waitFor(() => expect(result.current.status).toBe('error'));

    await act(() => {
      result.current.showNextMonth();
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.visibleMonth).toBe('2026-10-01');
    expect(result.current.selectedDate).toBe('2026-10-01');
  });

  it('破棄後にカレンダー取得が完了しても予定取得へ進まない', async () => {
    const repositories = createRepositories([]);
    const holidayProvider = createHolidayProvider();
    const deferred = createDeferred<Calendar>();
    repositories.calendars.getDefault.mockReturnValue(deferred.promise);
    const { unmount } = await renderHook(() =>
      useMonthCalendar({
        ...repositories,
        holidayProvider,
        weekStartsOn: 1,
        now: () => new Date(2026, 8, 8, 12),
      }),
    );

    expect(repositories.calendars.getDefault).toHaveBeenCalledTimes(1);
    await unmount();
    await act(() => {
      deferred.resolve(calendar);
    });

    expect(repositories.events.listByAnchorRange).not.toHaveBeenCalled();
    expect(holidayProvider.list).not.toHaveBeenCalled();
    expect(repositories.temporalDefinitions.getById).not.toHaveBeenCalled();
  });

  it('破棄後に予定取得が完了しても祝日と時間定義の取得へ進まない', async () => {
    const repositories = createRepositories([]);
    const holidayProvider = createHolidayProvider();
    const deferred = createDeferred<CalendarEvent[]>();
    repositories.events.listByAnchorRange.mockReturnValue(deferred.promise);
    const { unmount } = await renderHook(() =>
      useMonthCalendar({
        ...repositories,
        holidayProvider,
        weekStartsOn: 1,
        now: () => new Date(2026, 8, 8, 12),
      }),
    );

    expect(repositories.events.listByAnchorRange).toHaveBeenCalledTimes(1);
    await unmount();
    await act(() => {
      deferred.resolve([fuzzyEvent]);
    });

    expect(holidayProvider.list).not.toHaveBeenCalled();
    expect(repositories.temporalDefinitions.getById).not.toHaveBeenCalled();
  });
});
