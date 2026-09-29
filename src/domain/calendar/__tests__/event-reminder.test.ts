import { normalizeEventReminders, parseEventReminder } from '../event-reminder';

describe('予定通知', () => {
  it('入力順ではなくsortOrderとIDで並べ、重複した事前時間を最初の1件へ集約する', () => {
    expect(normalizeEventReminders('event-1', [
      { id: 'r2', eventId: 'event-1', minutesBefore: 30, sortOrder: 9 },
      { id: 'r1', eventId: 'event-1', minutesBefore: 10, sortOrder: 4 },
      { id: 'duplicate', eventId: 'event-1', minutesBefore: 30, sortOrder: 10 },
    ])).toEqual({
      ok: true,
      value: [
        { id: 'r1', eventId: 'event-1', minutesBefore: 10, sortOrder: 0 },
        { id: 'r2', eventId: 'event-1', minutesBefore: 30, sortOrder: 1 },
      ],
    });
  });

  it.each([
    ['負の事前時間', { id: 'r', eventId: 'event-1', minutesBefore: -1, sortOrder: 0 }],
    ['小数の並び順', { id: 'r', eventId: 'event-1', minutesBefore: 10, sortOrder: 0.5 }],
    ['空のID', { id: '', eventId: 'event-1', minutesBefore: 10, sortOrder: 0 }],
  ])('%sを拒否する', (_, reminder) => {
    expect(parseEventReminder(reminder).ok).toBe(false);
  });

  it('別の予定IDを含む通知を保存前に拒否する', () => {
    expect(normalizeEventReminders('event-1', [
      { id: 'r', eventId: 'event-2', minutesBefore: 10, sortOrder: 0 },
    ])).toEqual({
      ok: false,
      error: { field: 'eventId', message: 'reminder eventId must match aggregate event id' },
    });
  });
});
