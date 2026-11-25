import { renderHook, waitFor } from '@testing-library/react-native';
import type { EventAggregate } from '@/domain/calendar/event-reminder';
import { createStandardTemporalDefinitions } from '@/domain/temporal/standard-definitions';
import { useEventDetails } from '../use-event-details';

test('日跨ぎのざっくり予定は見出しに時刻を載せず、実際の通知日時を表示する', async () => {
  const timestamp = '2026-11-20T00:00:00.000Z';
  const deepNight = createStandardTemporalDefinitions('personal', timestamp)
    .find((definition) => definition.key === 'late_night')!;
  const aggregate: EventAggregate = {
    event: {
      id: 'e', title: '観測', calendarId: 'personal', location: null, noteDocument: null,
      colorId: null, recurrenceRule: null, createdTimeZoneId: 'Asia/Tokyo',
      createdAt: timestamp, updatedAt: timestamp, temporalType: 'fuzzy',
      temporalDefinitionId: deepNight.id, resolutionContext: null, anchorDate: '2026-11-30', endDate: '2026-11-30',
    },
    reminders: [{
      id: 'r', eventId: 'e', sortOrder: 0,
      timing: { version: 1, kind: 'relativeMinutes', anchor: 'end', minutesBefore: 60 },
    }],
  };
  const events = { getById: jest.fn().mockResolvedValue(aggregate), getOccurrenceEditData: jest.fn() };
  const temporalDefinitions = { getById: jest.fn().mockResolvedValue(deepNight) };
  const { result } = await renderHook(() => useEventDetails({ events, temporalDefinitions, id: 'e', revision: 1 }));

  await waitFor(() => expect(result.current).toMatchObject({
    status: 'ready',
    details: {
      title: '観測',
      timeLabel: '11月30日（月）　深夜',
      reminders: [{ id: 'r', dateTime: '12月1日（火） 01:00', condition: '終了1時間前' }],
    },
  }));
});

test('日跨ぎのきっちり予定は開始と終了の日時を表示する', async () => {
  const timestamp = '2026-11-20T00:00:00.000Z';
  const aggregate: EventAggregate = {
    event: {
      id: 'e', title: '観測', calendarId: 'personal', location: null, noteDocument: null,
      colorId: null, recurrenceRule: null, createdTimeZoneId: 'Asia/Tokyo',
      createdAt: timestamp, updatedAt: timestamp, temporalType: 'exact',
      anchorDate: '2026-11-30', startTime: '22:00', duration: { type: 'fixed', minutes: 240 },
    },
    reminders: [],
  };
  const events = { getById: jest.fn().mockResolvedValue(aggregate), getOccurrenceEditData: jest.fn() };
  const temporalDefinitions = { getById: jest.fn() };
  const { result } = await renderHook(() => useEventDetails({ events, temporalDefinitions, id: 'e', revision: 1 }));

  await waitFor(() => expect(result.current).toMatchObject({
    status: 'ready',
    details: { timeLabel: '11月30日（月） 22:00〜12月1日（火） 02:00' },
  }));
});
