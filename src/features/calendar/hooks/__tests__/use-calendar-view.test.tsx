import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { Calendar } from '@/domain/calendar/calendar';
import type { CalendarEvent } from '@/domain/calendar/event';
import type { HolidayProvider } from '@/domain/calendar/holiday';
import type {
  CalendarRepository,
  EventRepository,
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
  return { calendars, events, temporalDefinitions, holidayProvider };
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
    });
    expect(result.current.twoDayDays.map((day) => day.date)).toEqual([
      '2026-09-08',
      '2026-09-09',
    ]);
    expect(result.current.twoDayDays[1]).toMatchObject({
      holidayName: 'テスト祝日',
      items: [{ title: '散歩', temporalLabel: '午後' }],
    });
    expect(dependencies.events.listByAnchorRange).toHaveBeenCalledWith(
      calendar.id,
      '2026-09-08',
      '2026-09-09',
    );
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
      '2026-09-01',
      '2026-09-30',
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
    expect(result.current.twoDayDays[1].items[0]?.title).toBe('更新後の予定');

    await act(async () => {
      oldRequest.resolve([event]);
      await Promise.resolve();
    });
    expect(result.current.twoDayDays[1].items[0]?.title).toBe('更新後の予定');
  });
});
