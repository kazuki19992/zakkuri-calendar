import { createDefaultCalendar, DEFAULT_CALENDAR_ID } from '../calendar';

describe('createDefaultCalendar', () => {
  it('creates the single MVP calendar with a stable id and wall-clock timezone zone', () => {
    expect(createDefaultCalendar('Asia/Tokyo', '2026-09-08T00:00:00.000Z')).toEqual({
      id: DEFAULT_CALENDAR_ID,
      name: 'マイカレンダー',
      timeZoneId: 'Asia/Tokyo',
      createdAt: '2026-09-08T00:00:00.000Z',
      updatedAt: '2026-09-08T00:00:00.000Z',
    });
  });

  it.each(['', '   '])('rejects an empty time-zone id', (timeZoneId) => {
    expect(() => createDefaultCalendar(timeZoneId, '2026-09-08T00:00:00.000Z')).toThrow(
      'timeZoneId must not be empty',
    );
  });

  it.each(['', '   '])('rejects an empty timestamp', (now) => {
    expect(() => createDefaultCalendar('Asia/Tokyo', now)).toThrow('now must not be empty');
  });
});
