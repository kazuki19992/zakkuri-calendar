import type { CalendarEvent } from '../event';
import {
  materializeOccurrenceReplacement,
  parseRecurrenceException,
} from '../recurrence-exception';

const NOW = '2026-10-01T00:00:00.000Z';

const seriesEvent: CalendarEvent = {
  id: 'series-1',
  calendarId: 'personal-default',
  title: '定例会',
  temporalType: 'allDay',
  anchorDate: '2026-10-01',
  endDate: '2026-10-02',
  createdTimeZoneId: 'Asia/Tokyo',
  location: '会議室A',
  notes: '元のメモ',
  colorId: 'blue',
  recurrenceRule: {
    version: 1,
    frequency: 'weekly',
    interval: 1,
    weekdays: [1],
    end: { type: 'never' },
  },
  createdAt: NOW,
  updatedAt: NOW,
};

const replacementEvent: CalendarEvent = {
  ...seriesEvent,
  id: 'replacement-1',
  title: '変更した定例会',
  anchorDate: '2026-10-07',
  endDate: '2026-10-09',
  location: '会議室B',
  notes: '変更したメモ',
  colorId: 'red',
  recurrenceRule: null,
};

describe('繰り返し予定の例外', () => {
  test('置換例外を検証して正規化する', () => {
    expect(parseRecurrenceException({
      seriesEventId: 'series-1',
      originalOccurrenceDate: '2026-10-05',
      kind: 'replaced',
      replacementEventId: 'replacement-1',
      overrideFields: ['title', 'temporal'],
      createdAt: NOW,
      updatedAt: NOW,
    })).toEqual({ ok: true, value: {
      seriesEventId: 'series-1',
      originalOccurrenceDate: '2026-10-05',
      kind: 'replaced',
      replacementEventId: 'replacement-1',
      overrideFields: ['title', 'temporal'],
      createdAt: NOW,
      updatedAt: NOW,
    } });
  });

  test.each([
    ['削除例外の置換ID', { kind: 'deleted', replacementEventId: 'replacement-1', overrideFields: [] }],
    ['置換例外の置換ID欠落', { kind: 'replaced', replacementEventId: null, overrideFields: ['title'] }],
    ['重複mask', { kind: 'replaced', replacementEventId: 'replacement-1', overrideFields: ['title', 'title'] }],
    ['不正な日付', { kind: 'deleted', replacementEventId: null, overrideFields: [], originalOccurrenceDate: '2026-02-30' }],
  ])('%sを拒否する', (_label, overrides) => {
    const result = parseRecurrenceException({
      seriesEventId: 'series-1',
      originalOccurrenceDate: '2026-10-05',
      createdAt: NOW,
      updatedAt: NOW,
      ...overrides,
    });
    expect(result.ok).toBe(false);
  });

  test('mask対象だけを置換し対象外はOccurrence日付へ移したシリーズ値を使う', () => {
    const actual = materializeOccurrenceReplacement({
      seriesEvent,
      replacementEvent,
      overrideFields: ['title'],
      occurrenceDate: '2026-10-05',
    });
    expect(actual).toMatchObject({
      id: 'replacement-1',
      title: '変更した定例会',
      anchorDate: '2026-10-05',
      endDate: '2026-10-06',
      location: '会議室A',
      notes: '元のメモ',
      colorId: 'blue',
      recurrenceRule: null,
    });
  });

  test('全maskでは置換予定の値を使う', () => {
    const actual = materializeOccurrenceReplacement({
      seriesEvent,
      replacementEvent,
      overrideFields: ['title', 'temporal', 'location', 'notes', 'color', 'reminders'],
      occurrenceDate: '2026-10-05',
    });
    expect(actual).toMatchObject({
      id: 'replacement-1',
      title: '変更した定例会',
      anchorDate: '2026-10-07',
      endDate: '2026-10-09',
      location: '会議室B',
      notes: '変更したメモ',
      colorId: 'red',
      recurrenceRule: null,
    });
  });
});
