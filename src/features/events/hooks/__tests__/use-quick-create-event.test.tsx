import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { Calendar } from '@/domain/calendar/calendar';
import type {
  CalendarRepository,
  EventRepository,
  TemporalDefinitionRepository,
} from '@/domain/calendar/repositories';
import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';
import { useQuickCreateEvent } from '../use-quick-create-event';

const calendar: Calendar = {
  id: 'personal-default',
  name: 'マイカレンダー',
  timeZoneId: 'Asia/Tokyo',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const morning: TemporalDefinition = {
  id: 'personal-default:morning',
  calendarId: calendar.id,
  key: 'morning',
  label: '朝',
  granularity: 'day',
  resolverConfig: { kind: 'timeOfDay', startMinute: 360, endMinute: 720 },
  fadeInRatio: 0.2,
  fadeOutRatio: 0.2,
  isSystem: true,
  isEnabled: true,
  sortOrder: 1,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const nextWeek: TemporalDefinition = {
  ...morning,
  id: 'personal-default:next-week',
  key: 'next-week',
  label: '来週',
  granularity: 'week',
  resolverConfig: {
    kind: 'week',
    selectionWeekOffset: 1,
    startWeekday: 1,
    endWeekday: 7,
  },
  sortOrder: 2,
};

const afternoon: TemporalDefinition = {
  ...morning,
  id: 'personal-default:afternoon',
  key: 'afternoon',
  label: '午後',
  resolverConfig: { kind: 'timeOfDay', startMinute: 720, endMinute: 1020 },
  sortOrder: 3,
};

type RepositoryDoubles = Readonly<{
  calendars: jest.Mocked<CalendarRepository>;
  events: jest.Mocked<EventRepository>;
  temporalDefinitions: jest.Mocked<TemporalDefinitionRepository>;
}>;

function createRepositories(): RepositoryDoubles {
  return {
    calendars: {
      getDefault: jest.fn().mockResolvedValue(calendar),
    },
    events: {
      create: jest.fn().mockResolvedValue(undefined),
      getById: jest.fn(),
      listByAnchorRange: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    temporalDefinitions: {
      listEnabled: jest.fn().mockResolvedValue([morning, nextWeek, afternoon]),
      getById: jest.fn(),
      disable: jest.fn(),
    },
  };
}

function createDeferred(): Readonly<{
  promise: Promise<void>;
  resolve(): void;
}> {
  let resolvePromise!: () => void;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

describe('ざっくり予定作成の状態調整', () => {
  it('日単位の時間表現だけを順序どおり読み込み先頭を選択する', async () => {
    const repositories = createRepositories();
    const { result } = await renderHook(() =>
      useQuickCreateEvent({
        ...repositories,
        initialDate: '2026-09-09',
        createId: () => 'event-new',
      }),
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.definitions).toEqual([morning, afternoon]);
    expect(result.current.selectedDefinitionId).toBe(morning.id);
    expect(repositories.temporalDefinitions.listEnabled).toHaveBeenCalledWith(calendar.id);
  });

  it('空白のタイトルでは保存せず入力エラーを表示する', async () => {
    const repositories = createRepositories();
    const { result } = await renderHook(() =>
      useQuickCreateEvent({
        ...repositories,
        initialDate: '2026-09-09',
        createId: () => 'event-new',
      }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));

    let saved = true;
    await act(async () => {
      result.current.setTitle('   ');
    });
    await act(async () => {
      saved = await result.current.save();
    });

    expect(saved).toBe(false);
    expect(result.current.titleError).toBe('タイトルを入力してください');
    expect(repositories.events.create).not.toHaveBeenCalled();
  });

  it('入力した予定を整形して保存する', async () => {
    const repositories = createRepositories();
    const { result } = await renderHook(() =>
      useQuickCreateEvent({
        ...repositories,
        initialDate: '2026-09-09',
        createId: () => 'event-new',
        now: () => '2026-09-09T12:34:56.000Z',
        getTimeZoneId: () => 'Asia/Tokyo',
      }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => {
      result.current.setTitle('  図書館へ行く  ');
      result.current.setAnchorDate('2026-09-10');
      result.current.selectDefinition(afternoon.id);
    });

    let saved = false;
    await act(async () => {
      saved = await result.current.save();
    });

    expect(saved).toBe(true);
    expect(repositories.events.create).toHaveBeenCalledWith({
      id: 'event-new',
      calendarId: calendar.id,
      title: '図書館へ行く',
      anchorDate: '2026-09-10',
      temporalType: 'fuzzy',
      temporalDefinitionId: afternoon.id,
      createdTimeZoneId: 'Asia/Tokyo',
      createdAt: '2026-09-09T12:34:56.000Z',
      updatedAt: '2026-09-09T12:34:56.000Z',
    });
  });

  it('保存中の再送信を受け付けない', async () => {
    const repositories = createRepositories();
    const deferred = createDeferred();
    repositories.events.create.mockReturnValue(deferred.promise);
    const { result } = await renderHook(() =>
      useQuickCreateEvent({
        ...repositories,
        initialDate: '2026-09-09',
        createId: () => 'event-new',
      }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => {
      result.current.setTitle('散歩');
    });

    let firstSave!: Promise<boolean>;
    await act(async () => {
      firstSave = result.current.save();
      await Promise.resolve();
    });

    let secondResult = true;
    await act(async () => {
      secondResult = await result.current.save();
    });
    expect(secondResult).toBe(false);
    expect(repositories.events.create).toHaveBeenCalledTimes(1);

    deferred.resolve();
    await act(async () => {
      await firstSave;
    });
  });

  it('保存に失敗しても入力を維持し再試行できる', async () => {
    const repositories = createRepositories();
    repositories.events.create.mockRejectedValueOnce(new Error('database unavailable'));
    const { result } = await renderHook(() =>
      useQuickCreateEvent({
        ...repositories,
        initialDate: '2026-09-09',
        createId: () => 'event-new',
      }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => {
      result.current.setTitle('買い物');
    });

    let saved = true;
    await act(async () => {
      saved = await result.current.save();
    });

    expect(saved).toBe(false);
    expect(result.current.title).toBe('買い物');
    expect(result.current.saveError).toBe('保存できませんでした。もう一度お試しください。');

    await act(async () => {
      saved = await result.current.save();
    });
    expect(saved).toBe(true);
    expect(repositories.events.create).toHaveBeenCalledTimes(2);
  });

  it('読み込みに失敗した場合は再試行できる', async () => {
    const repositories = createRepositories();
    repositories.calendars.getDefault
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce(calendar);
    const { result } = await renderHook(() =>
      useQuickCreateEvent({
        ...repositories,
        initialDate: '2026-09-09',
      }),
    );
    await waitFor(() => expect(result.current.status).toBe('error'));

    await act(async () => {
      result.current.retry();
    });

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(repositories.calendars.getDefault).toHaveBeenCalledTimes(2);
  });
});
