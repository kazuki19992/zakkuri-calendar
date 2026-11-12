import { renderHook, waitFor } from '@testing-library/react-native';
import type { Calendar } from '@/domain/calendar/calendar';
import type { CalendarEvent } from '@/domain/calendar/event';
import type { HolidayProvider } from '@/domain/calendar/holiday';
import type { CalendarRepository, EventRepository, TemporalDefinitionRepository } from '@/domain/calendar/repositories';
import { useDayCalendar } from '../use-day-calendar';

const calendar: Calendar = {
  id: 'personal-default', name: 'マイカレンダー', timeZoneId: 'Asia/Tokyo', colorId: 'blue',
  createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
};

const event: CalendarEvent = {
  id: 'event-1', calendarId: calendar.id, title: '通院', anchorDate: '2026-09-21',
  temporalType: 'exact', startTime: '10:00', duration: { type: 'fixed', minutes: 30 },
  location: null, noteDocument: null, colorId: null, recurrenceRule: null,
  createdTimeZoneId: 'Asia/Tokyo', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
};

function createDependencies() {
  const calendars: jest.Mocked<CalendarRepository> = { getDefault: jest.fn().mockResolvedValue(calendar), setColor: jest.fn() };
  const events: jest.Mocked<EventRepository> = {
    create: jest.fn(), getById: jest.fn(), listByAnchorRange: jest.fn(),
    readTemporalSchedule: jest.fn(), listSchedule: jest.fn().mockResolvedValue({ events: [event], exceptions: [], replacementEvents: [] }),
    getOccurrenceEditData: jest.fn(), saveOccurrenceException: jest.fn(), deleteOccurrenceException: jest.fn(),
    applyRecurrenceMutation: jest.fn(), update: jest.fn(), delete: jest.fn(),
  };
  const temporalDefinitions: jest.Mocked<TemporalDefinitionRepository> = { listEditable: jest.fn(), previewUpdate: jest.fn(), updateDefinition: jest.fn(), listEnabled: jest.fn(), getById: jest.fn(), disable: jest.fn() };
  const holidayProvider: jest.Mocked<HolidayProvider> = { list: jest.fn().mockReturnValue({ status: 'available', holidays: [{ date: '2026-09-21', name: '敬老の日' }] }) };
  const settings = { getHolidayPreferences: jest.fn().mockResolvedValue({ version: 1, calendarId: 'jp', adjustThisWeekDeadline: false }),
    getCalendarWeekStartsOn: jest.fn().mockResolvedValue(1), getCalendarVisible: jest.fn().mockResolvedValue(true),
    setUndeterminedFadeMinutes: jest.fn(), getUndeterminedFadeMinutes: jest.fn().mockResolvedValue(120) };
  events.readTemporalSchedule.mockImplementation(async (id,from,through)=>({schedule:await events.listSchedule(id,from,through),definitions:[],undeterminedFadeMinutes:await settings.getUndeterminedFadeMinutes()}));
  return { calendars, events, temporalDefinitions, holidayProvider, settings };
}

describe('1日表示の状態調整', () => {
  it('祝日無効と情報未対応を区別し予定を維持する', async () => {
    const dependencies = createDependencies();
    dependencies.settings.getHolidayPreferences.mockResolvedValue({ version: 1, calendarId: 'none', adjustThisWeekDeadline: false });
    dependencies.holidayProvider.list.mockReturnValue({ status: 'unsupported' });
    const { result, rerender } = await renderHook(({ revision }: { revision: number }) => useDayCalendar({ ...dependencies, date: '2051-01-01', refreshRevision: revision }), { initialProps: { revision: 0 } });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.holidaySupport).toBe('available');
    expect(result.current.holidayName).toBeNull();
    dependencies.settings.getHolidayPreferences.mockResolvedValue({ version: 1, calendarId: 'jp', adjustThisWeekDeadline: false });
    await rerender({ revision: 1 });
    await waitFor(() => expect(result.current.holidaySupport).toBe('unsupported'));
  });
  it('対象日の予定と祝日だけを読み込み、agenda項目へ変換する', async () => {
    const dependencies = createDependencies();
    const { result } = await renderHook(() => useDayCalendar({ ...dependencies, date: '2026-09-21' }));

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(dependencies.events.listSchedule).toHaveBeenCalledWith(calendar.id, '2026-09-19', '2026-09-22');
    expect(result.current).toMatchObject({
      holidayName: '敬老の日',
      items: [{ eventId: 'event-1', title: '通院', temporalLabel: '10:00' }],
    });
  });

  it('非表示カレンダーの予定はpreviewにも出さず祝日を維持する', async () => {
    const dependencies = createDependencies();
    dependencies.settings.getCalendarVisible.mockResolvedValue(false);
    const { result } = await renderHook(() => useDayCalendar({ ...dependencies, date: '2026-09-21' }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.items).toEqual([]);
    expect(result.current.holidayName).toBe('敬老の日');
  });

  it('取得予備日の予定は除外する', async () => {
    const dependencies = createDependencies();
    const { result } = await renderHook(() => useDayCalendar({ ...dependencies, date: '2026-09-22' }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.items).toEqual([]);
  });

  it('読み込み失敗時は予定を表示せずerror状態にする', async () => {
    const dependencies = createDependencies();
    dependencies.events.listSchedule.mockRejectedValue(new Error('offline'));
    const { result } = await renderHook(() => useDayCalendar({ ...dependencies, date: '2026-09-21' }));

    await waitFor(() => expect(result.current.status).toBe('error'));

    expect(result.current.items).toEqual([]);
  });
});
