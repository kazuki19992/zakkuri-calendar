import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { Calendar } from '@/domain/calendar/calendar';
import type { CalendarEvent } from '@/domain/calendar/event';
import type {
  CalendarRepository,
  EventRepository,
  TemporalDefinitionRepository,
} from '@/domain/calendar/repositories';
import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';
import { useEventEditor } from '../use-event-editor';

const calendar: Calendar = {
  id: 'personal-default', name: 'マイカレンダー', timeZoneId: 'Asia/Tokyo',
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
  createdAt: calendar.createdAt, updatedAt: calendar.updatedAt,
};

function createRepositories(): Readonly<{
  calendars: jest.Mocked<CalendarRepository>;
  events: jest.Mocked<EventRepository>;
  temporalDefinitions: jest.Mocked<TemporalDefinitionRepository>;
}> {
  return {
    calendars: { getDefault: jest.fn().mockResolvedValue(calendar) },
    events: { create: jest.fn(), getById: jest.fn().mockResolvedValue(null), listByAnchorRange: jest.fn(), update: jest.fn(), delete: jest.fn() },
    temporalDefinitions: { listEnabled: jest.fn().mockResolvedValue([morning]), getById: jest.fn(), disable: jest.fn() },
  };
}

describe('予定編集の状態調整', () => {
  it('新規の正確な予定を開始終了時刻の差分で保存する', async () => {
    const repositories = createRepositories();
    const { result } = await renderHook(() => useEventEditor({
      ...repositories, initial: { date: '2026-09-09', startTime: '09:30', endTime: '11:45', temporalType: 'exact' },
      createId: () => 'event-new', now: () => '2026-09-09T12:00:00.000Z', getTimeZoneId: () => 'Asia/Tokyo',
    }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { result.current.setTitle('会議'); });
    await act(async () => { await result.current.save(); });

    expect(repositories.events.create).toHaveBeenCalledWith(expect.objectContaining({
      id: 'event-new', title: '会議', temporalType: 'exact', startTime: '09:30', duration: { type: 'fixed', minutes: 135 },
    }));
  });

  it('終了時刻が開始より前なら翌日まで継続する予定を保存する', async () => {
    const repositories = createRepositories();
    const { result } = await renderHook(() => useEventEditor({
      ...repositories, initial: { date: '2026-09-09', startTime: '23:30', endTime: '00:30', temporalType: 'exact' },
      createId: () => 'event-new', now: () => '2026-09-09T12:00:00.000Z', getTimeZoneId: () => 'Asia/Tokyo',
    }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { result.current.setTitle('読書'); });
    await act(async () => { await result.current.save(); });

    expect(repositories.events.create).toHaveBeenCalledWith(expect.objectContaining({
      startTime: '23:30', duration: { type: 'fixed', minutes: 60 },
    }));
  });

  it('編集予定をフォーム値へ展開して更新と削除に同じIDを使う', async () => {
    const repositories = createRepositories();
    repositories.events.getById.mockResolvedValue(exactEvent);
    const { result } = await renderHook(() => useEventEditor({
      ...repositories, eventId: exactEvent.id,
      initial: { date: '2026-09-01', startTime: '09:00', endTime: '10:00', temporalType: 'exact' },
      now: () => '2026-09-10T12:00:00.000Z', getTimeZoneId: () => 'Asia/Tokyo',
    }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toMatchObject({ mode: 'edit', title: '歯医者', startTime: '23:30', endTime: '00:30' });
    await act(async () => { result.current.setTitle('夜の歯医者'); await result.current.save(); });
    await act(async () => { await result.current.remove(); });

    expect(repositories.events.update).toHaveBeenCalledWith(expect.objectContaining({ id: exactEvent.id, createdAt: exactEvent.createdAt, updatedAt: '2026-09-10T12:00:00.000Z' }));
    expect(repositories.events.delete).toHaveBeenCalledWith(exactEvent.id);
  });

  it('同じ開始終了時刻では保存せず入力を維持する', async () => {
    const repositories = createRepositories();
    const { result } = await renderHook(() => useEventEditor({
      ...repositories, initial: { date: '2026-09-09', startTime: '09:30', endTime: '09:30', temporalType: 'exact' },
    }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { result.current.setTitle('会議'); await result.current.save(); });

    expect(repositories.events.create).not.toHaveBeenCalled();
    expect(result.current.endTimeError).toBe('終了時刻を開始時刻と異なる時刻にしてください');
    expect(result.current.title).toBe('会議');
  });
});
