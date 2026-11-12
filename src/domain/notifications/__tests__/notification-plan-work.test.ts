import * as occurrences from '@/domain/calendar/event-occurrence';
import { planNotifications } from '../notification-plan';
import type { CalendarEvent } from '@/domain/calendar/event';
const event: CalendarEvent = {
  id: 's',
  calendarId: 'c',
  title: '予定',
  temporalType: 'exact',
  anchorDate: '2026-11-13',
  startTime: '12:00',
  duration: { type: 'fixed', minutes: 60 },
  recurrenceRule: {
    version: 1,
    frequency: 'daily',
    interval: 1,
    weekdays: [],
    end: { type: 'count', count: 2 },
  },
  createdAt: '',
  updatedAt: '',
  createdTimeZoneId: 'Asia/Tokyo',
  location: null,
  noteDocument: null,
  colorId: null,
};
afterEach(() => jest.restoreAllMocks());
test('系列も置換予定も通知なしなら開催展開の計算を省く', () => {
  const expand = jest.spyOn(occurrences, 'expandEventOccurrences');
  const p = planNotifications(
    {
      revision: 0,
      definitions: [],
      exceptions: [],
      aggregates: [{ event, reminders: [] }],
    },
    new Date(2026, 10, 12),
  );
  expect(p.requests).toEqual([]);
  expect(expand).not.toHaveBeenCalled();
});
test('系列が通知なしでも移動例外だけにある通知は予約する', () => {
  const p = planNotifications(
    {
      revision: 0,
      definitions: [],
      exceptions: [
        {
          seriesEventId: 's',
          originalOccurrenceDate: '2026-11-14',
          kind: 'replaced',
          replacementEventId: 'r',
          overrideFields: ['temporal', 'reminders'],
          createdAt: '',
          updatedAt: '',
        },
      ],
      aggregates: [
        { event, reminders: [] },
        {
          event: {
            ...event,
            id: 'r',
            anchorDate: '2026-11-20',
            recurrenceRule: null,
          },
          reminders: [
            { id: 'reminder', eventId: 'r', sortOrder: 0, minutesBefore: 10 },
          ],
        },
      ],
    },
    new Date(2026, 10, 12),
  );
  expect(p.requests).toHaveLength(1);
  expect(p.requests[0].target).toEqual({
    eventId: 's',
    occurrenceDate: '2026-11-14',
  });
});
