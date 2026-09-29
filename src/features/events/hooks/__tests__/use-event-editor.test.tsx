import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { Calendar } from '@/domain/calendar/calendar';
import type { CalendarEvent } from '@/domain/calendar/event';
import type { EventAggregate } from '@/domain/calendar/event-reminder';
import type {
  CalendarRepository,
  EventRepository,
  SettingsRepository,
  TemporalDefinitionRepository,
} from '@/domain/calendar/repositories';
import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';
import { useEventEditor } from '../use-event-editor';

const calendar: Calendar = {
  id: 'personal-default', name: 'マイカレンダー', timeZoneId: 'Asia/Tokyo',
  colorId: 'blue',
  createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
};
const morning: TemporalDefinition = {
  id: 'personal-default:morning', calendarId: calendar.id, key: 'morning', label: '朝', granularity: 'day',
  resolverConfig: { kind: 'timeOfDay', startMinute: 360, endMinute: 720 }, fadeInRatio: 0.2, fadeOutRatio: 0.2,
  isSystem: true, isEnabled: true, sortOrder: 1, createdAt: calendar.createdAt, updatedAt: calendar.updatedAt,
};
const exactEvent: CalendarEvent = {
  id: 'event-1', calendarId: calendar.id, title: '歯医者', anchorDate: '2026-09-09', temporalType: 'exact',
  startTime: '23:30', duration: { type: 'fixed', minutes: 60 }, createdTimeZoneId: 'Asia/Tokyo',
  location: '渋谷区', notes: '保険証を持参', colorId: 'teal',
  recurrenceRule: { version: 1, frequency: 'weekly', interval: 1, weekdays: [3], end: { type: 'never' } },
  createdAt: calendar.createdAt, updatedAt: calendar.updatedAt,
};
const exactAggregate: EventAggregate = {
  event: exactEvent,
  reminders: [{ id: 'reminder-1', eventId: exactEvent.id, minutesBefore: 30, sortOrder: 0 }],
};

function createRepositories(): Readonly<{
  calendars: jest.Mocked<CalendarRepository>;
  events: jest.Mocked<EventRepository>;
  settings: jest.Mocked<SettingsRepository>;
  temporalDefinitions: jest.Mocked<TemporalDefinitionRepository>;
}> {
  return {
    calendars: { getDefault: jest.fn().mockResolvedValue(calendar), setColor: jest.fn() },
    events: { create: jest.fn(), getById: jest.fn().mockResolvedValue(null), listByAnchorRange: jest.fn(), update: jest.fn(), delete: jest.fn() },
    settings: {
      getDefaultExactDuration: jest.fn(),
      setDefaultExactDuration: jest.fn().mockResolvedValue(undefined),
      getUndeterminedFadeMinutes: jest.fn(),
      getCalendarVisible: jest.fn(),
      setCalendarVisible: jest.fn().mockResolvedValue(undefined),
      getLastEventEditorTab: jest.fn().mockResolvedValue('fuzzy'),
      setLastEventEditorTab: jest.fn().mockResolvedValue(undefined),
    },
    temporalDefinitions: { listEnabled: jest.fn().mockResolvedValue([morning]), getById: jest.fn(), disable: jest.fn() },
  };
}

describe('予定編集の状態調整', () => {
  it('新規の正確な予定を開始終了時刻の差分で保存する', async () => {
    const repositories = createRepositories();
    const { result } = await renderHook(() => useEventEditor({
      ...repositories, initial: { date: '2026-09-09', startTime: '09:30', endTime: '11:45', temporalType: 'exact' },
      initialTab: 'exact',
      createId: () => 'event-new', now: () => '2026-09-09T12:00:00.000Z', getTimeZoneId: () => 'Asia/Tokyo',
    }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { result.current.setTitle('会議'); });
    await act(async () => { await result.current.save(); });

    expect(repositories.events.create).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({
        id: 'event-new', title: '会議', temporalType: 'exact', startTime: '09:30', duration: { type: 'fixed', minutes: 135 },
        location: null, notes: null, colorId: null, recurrenceRule: null,
      }),
      reminders: [],
    }));
  });

  it('終了時刻が開始より前なら翌日まで継続する予定を保存する', async () => {
    const repositories = createRepositories();
    const { result } = await renderHook(() => useEventEditor({
      ...repositories, initial: { date: '2026-09-09', startTime: '23:30', endTime: '00:30', temporalType: 'exact' },
      initialTab: 'exact',
      createId: () => 'event-new', now: () => '2026-09-09T12:00:00.000Z', getTimeZoneId: () => 'Asia/Tokyo',
    }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { result.current.setTitle('読書'); });
    await act(async () => { await result.current.save(); });

    expect(repositories.events.create).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({ startTime: '23:30', duration: { type: 'fixed', minutes: 60 } }),
      reminders: [],
    }));
  });

  it('編集予定をフォーム値へ展開して更新と削除に同じIDを使う', async () => {
    const repositories = createRepositories();
    repositories.events.getById.mockResolvedValue(exactAggregate);
    const { result } = await renderHook(() => useEventEditor({
      ...repositories, eventId: exactEvent.id,
      initial: { date: '2026-09-01', startTime: '09:00', endTime: '10:00', temporalType: 'exact' },
      now: () => '2026-09-10T12:00:00.000Z', getTimeZoneId: () => 'Asia/Tokyo',
    }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toMatchObject({ mode: 'edit', title: '歯医者', startTime: '23:30', endTime: '00:30' });
    await act(async () => { result.current.setTitle('夜の歯医者'); });
    await act(async () => { await result.current.save(); });
    await act(async () => { await result.current.remove(); });

    expect(repositories.events.update).toHaveBeenCalledWith({
      event: expect.objectContaining({
        id: exactEvent.id,
        title: '夜の歯医者',
        createdAt: exactEvent.createdAt,
        createdTimeZoneId: exactEvent.createdTimeZoneId,
        updatedAt: '2026-09-10T12:00:00.000Z',
        location: '渋谷区',
        notes: '保険証を持参',
        colorId: 'teal',
        recurrenceRule: { version: 1, frequency: 'weekly', interval: 1, weekdays: [3], end: { type: 'never' } },
      }),
      reminders: exactAggregate.reminders,
    });
    expect(repositories.events.delete).toHaveBeenCalledWith(exactEvent.id);
  });

  it.each([
    ['instant', { type: 'instant' } as const],
    ['undetermined', { type: 'undetermined' } as const],
    ['24時間超のfixed', { type: 'fixed', minutes: 2_940 } as const],
  ])('時刻入力を変更しなければ%s durationを保持する', async (_label, duration) => {
    const repositories = createRepositories();
    const event = { ...exactEvent, startTime: '09:30', duration };
    repositories.events.getById.mockResolvedValue({ event, reminders: exactAggregate.reminders });
    const { result } = await renderHook(() => useEventEditor({
      ...repositories,
      eventId: event.id,
      initial: { date: '2026-09-01', startTime: '09:00', endTime: '10:00', temporalType: 'exact' },
      now: () => '2026-09-10T12:00:00.000Z',
    }));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => { result.current.setTitle('更新後'); });
    await act(async () => { await result.current.save(); });

    expect(repositories.events.update).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({ startTime: '09:30', duration }),
    }));
  });

  it('別カレンダーの予定ではそのカレンダーの時間表現を読み込む', async () => {
    const repositories = createRepositories();
    const otherCalendarEvent = { ...exactEvent, calendarId: 'shared-calendar' };
    repositories.events.getById.mockResolvedValue({ event: otherCalendarEvent, reminders: [] });
    const { result } = await renderHook(() => useEventEditor({
      ...repositories,
      eventId: otherCalendarEvent.id,
      initial: { date: '2026-09-01', startTime: '09:00', endTime: '10:00', temporalType: 'exact' },
    }));

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(repositories.temporalDefinitions.listEnabled).toHaveBeenCalledWith('shared-calendar');
  });

  it('同じ開始終了時刻では保存せず入力を維持する', async () => {
    const repositories = createRepositories();
    const { result } = await renderHook(() => useEventEditor({
      ...repositories, initial: { date: '2026-09-09', startTime: '09:30', endTime: '09:30', temporalType: 'exact' },
      initialTab: 'exact',
    }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { result.current.setTitle('会議'); await result.current.save(); });

    expect(repositories.events.create).not.toHaveBeenCalled();
    expect(result.current.endTimeError).toBe('終了時刻を開始時刻と異なる時刻にしてください');
    expect(result.current.title).toBe('会議');
  });

  it('新規の終日予定は基準日を終了日にして集約として保存する', async () => {
    const repositories = createRepositories();
    const { result } = await renderHook(() => useEventEditor({
      ...repositories,
      initial: { date: '2026-09-09', startTime: '09:00', endTime: '10:00', temporalType: 'allDay' },
      createId: () => 'event-all-day', now: () => '2026-09-09T12:00:00.000Z', getTimeZoneId: () => 'Asia/Tokyo',
    }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { result.current.setTitle('休暇'); });
    await act(async () => { await result.current.save(); });

    expect(repositories.events.create).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({
        temporalType: 'allDay', anchorDate: '2026-09-09', endDate: '2026-09-09',
        location: null, notes: null, colorId: null, recurrenceRule: null,
      }),
      reminders: [],
    }));
  });

  it('既存の終日予定は終了日と通知を保持して更新する', async () => {
    const repositories = createRepositories();
    const aggregate: EventAggregate = {
      event: {
        ...exactEvent,
        temporalType: 'allDay',
        anchorDate: '2026-09-09',
        endDate: '2026-09-11',
      },
      reminders: [{ id: 'reminder-all-day', eventId: exactEvent.id, minutesBefore: 60, sortOrder: 0 }],
    };
    repositories.events.getById.mockResolvedValue(aggregate);
    const { result } = await renderHook(() => useEventEditor({
      ...repositories, eventId: exactEvent.id,
      initial: { date: '2026-09-01', startTime: '09:00', endTime: '10:00', temporalType: 'exact' },
      now: () => '2026-09-10T12:00:00.000Z', getTimeZoneId: () => 'Asia/Tokyo',
    }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { result.current.setTitle('連休'); });
    await act(async () => { await result.current.save(); });

    expect(repositories.events.update).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({ temporalType: 'allDay', endDate: '2026-09-11' }),
      reminders: aggregate.reminders,
    }));
  });

  it.each([
    ['1日予定を翌日へ移動', '2026-09-09', '2026-09-09', '2026-09-10', '2026-09-10'],
    ['3日予定を前月へ移動', '2026-09-09', '2026-09-11', '2026-08-30', '2026-09-01'],
  ])('%sしても包含日数を保持する', async (_label, originalStart, originalEnd, nextStart, nextEnd) => {
    const repositories = createRepositories();
    const aggregate: EventAggregate = {
      event: {
        ...exactEvent,
        temporalType: 'allDay',
        anchorDate: originalStart,
        endDate: originalEnd,
      },
      reminders: [],
    };
    repositories.events.getById.mockResolvedValue(aggregate);
    const { result } = await renderHook(() => useEventEditor({
      ...repositories,
      eventId: exactEvent.id,
      initial: { date: '2026-09-01', startTime: '09:00', endTime: '10:00', temporalType: 'exact' },
      now: () => '2026-09-10T12:00:00.000Z',
    }));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => { result.current.setAnchorDate(nextStart); });
    await act(async () => { await result.current.save(); });

    expect(repositories.events.update).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({ anchorDate: nextStart, endDate: nextEnd }),
    }));
  });

  it('新規予定では最後に開いたexactタブを復元する', async () => {
    const repositories = createRepositories();
    repositories.settings.getLastEventEditorTab.mockResolvedValue('exact');
    const { result } = await renderHook(() => useEventEditor({
      ...repositories,
      initial: { date: '2026-09-09', startTime: '09:00', endTime: '10:00', temporalType: 'fuzzy' },
    }));

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.temporalType).toBe('exact');
  });

  it('明示されたexactタブは保存済みタブより優先する', async () => {
    const repositories = createRepositories();
    repositories.settings.getLastEventEditorTab.mockResolvedValue('fuzzy');
    const { result } = await renderHook(() => useEventEditor({
      ...repositories,
      initial: { date: '2026-09-09', startTime: '09:00', endTime: '10:00', temporalType: 'exact' },
      initialTab: 'exact',
    }));

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.temporalType).toBe('exact');
    expect(repositories.settings.getLastEventEditorTab).not.toHaveBeenCalled();
  });

  it('タブを変更すると次回復元用に保存する', async () => {
    const repositories = createRepositories();
    const { result } = await renderHook(() => useEventEditor({
      ...repositories,
      initial: { date: '2026-09-09', startTime: '09:00', endTime: '10:00', temporalType: 'fuzzy' },
      now: () => '2026-09-10T12:00:00.000Z',
    }));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => { result.current.setTemporalType('exact'); });

    await waitFor(() => expect(repositories.settings.setLastEventEditorTab).toHaveBeenCalledWith(
      'exact',
      '2026-09-10T12:00:00.000Z',
    ));
  });

  it('新規予定を終日へ切り替えると基準日を終了日にする', async () => {
    const repositories = createRepositories();
    const { result } = await renderHook(() => useEventEditor({
      ...repositories,
      initial: { date: '2026-09-09', startTime: '09:00', endTime: '10:00', temporalType: 'exact' },
      createId: () => 'event-switch-all-day', now: () => '2026-09-09T12:00:00.000Z', getTimeZoneId: () => 'Asia/Tokyo',
    }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => {
      result.current.setTitle('終日予定');
      result.current.setAnchorDate('2026-09-10');
      result.current.setTemporalType('allDay');
    });
    await act(async () => { await result.current.save(); });

    expect(repositories.events.create).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({ temporalType: 'allDay', anchorDate: '2026-09-10', endDate: '2026-09-10' }),
    }));
  });
});
