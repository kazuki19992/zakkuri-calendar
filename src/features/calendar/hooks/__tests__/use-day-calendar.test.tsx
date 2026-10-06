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
    listSchedule: jest.fn().mockResolvedValue({ events: [event], exceptions: [], replacementEvents: [] }),
    getOccurrenceEditData: jest.fn(), saveOccurrenceException: jest.fn(), deleteOccurrenceException: jest.fn(),
    applyRecurrenceMutation: jest.fn(), update: jest.fn(), delete: jest.fn(),
  };
  const temporalDefinitions: jest.Mocked<TemporalDefinitionRepository> = { listEnabled: jest.fn(), getById: jest.fn(), disable: jest.fn() };
  const holidayProvider: jest.Mocked<HolidayProvider> = { list: jest.fn().mockReturnValue({ status: 'available', holidays: [{ date: '2026-09-21', name: '敬老の日' }] }) };
  return { calendars, events, temporalDefinitions, holidayProvider };
}

describe('1日表示の状態調整', () => {
  it('対象日の予定と祝日だけを読み込み、agenda項目へ変換する', async () => {
    const dependencies = createDependencies();
    const { result } = await renderHook(() => useDayCalendar({ ...dependencies, date: '2026-09-21' }));

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(dependencies.events.listSchedule).toHaveBeenCalledWith(calendar.id, '2026-09-21', '2026-09-21');
    expect(result.current).toMatchObject({
      holidayName: '敬老の日',
      items: [{ eventId: 'event-1', title: '通院', temporalLabel: '10:00' }],
    });
  });

  it('読み込み失敗時は予定を表示せずerror状態にする', async () => {
    const dependencies = createDependencies();
    dependencies.events.listSchedule.mockRejectedValue(new Error('offline'));
    const { result } = await renderHook(() => useDayCalendar({ ...dependencies, date: '2026-09-21' }));

    await waitFor(() => expect(result.current.status).toBe('error'));

    expect(result.current.items).toEqual([]);
  });
});
