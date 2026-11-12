/** @jest-environment node */
import { reminderFireAt } from '../notification-plan';
import type { CalendarEvent } from '@/domain/calendar/event';
const inNewYork =
  Intl.DateTimeFormat().resolvedOptions().timeZone === 'America/New_York';
const zoned = inNewYork ? test : test.skip;
const base: CalendarEvent = {
  id: 'e',
  calendarId: 'c',
  title: '予定',
  temporalType: 'exact',
  anchorDate: '2026-03-08',
  startTime: '02:40',
  duration: { type: 'instant' },
  location: null,
  noteDocument: null,
  colorId: null,
  recurrenceRule: null,
  createdTimeZoneId: 'Asia/Tokyo',
  createdAt: '',
  updatedAt: '',
};
const snapshot = {
  revision: 0,
  aggregates: [],
  definitions: [],
  exceptions: [],
};
describe('米国夏時間の壁時計解決', () => {
  zoned('欠落した2時30分は次の有効な3時30分へ進める', () => {
    const d = new Date(
      reminderFireAt(
        base,
        {
          version: 1,
          kind: 'relativeMinutes',
          anchor: 'start',
          minutesBefore: 10,
        },
        snapshot,
      ),
    );
    expect([d.getHours(), d.getMinutes(), d.getTimezoneOffset()]).toEqual([
      3, 30, 240,
    ]);
  });
  zoned('重複する1時30分は最初の夏時間側を選ぶ', () => {
    const d = new Date(
      reminderFireAt(
        { ...base, anchorDate: '2026-11-01', startTime: '01:30' },
        {
          version: 1,
          kind: 'relativeMinutes',
          anchor: 'start',
          minutesBefore: 0,
        },
        snapshot,
      ),
    );
    expect([d.getHours(), d.getMinutes(), d.getTimezoneOffset()]).toEqual([
      1, 30, 240,
    ]);
  });
});
