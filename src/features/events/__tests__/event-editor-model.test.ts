import type { CalendarEvent } from '@/domain/calendar/event';
import type { EventReminder } from '@/domain/calendar/event-reminder';
import {
  buildEventReminders,
  buildRecurrenceRule,
  formatEditorDate,
  getEditorExactDuration,
  getExactEditorRange,
  getRecurrenceDraft,
  getReminderDrafts,
  moveEditorRangeStart,
  moveReminderDraft,
} from '../event-editor-model';

const createExactEvent = (
  duration: Extract<CalendarEvent, { temporalType: 'exact' }>['duration'],
): Extract<CalendarEvent, { temporalType: 'exact' }> => ({
  id: 'event-1',
  calendarId: 'calendar-1',
  title: '予定',
  anchorDate: '2026-12-31',
  createdTimeZoneId: 'Asia/Tokyo',
  location: null,
  notes: null,
  colorId: null,
  recurrenceRule: null,
  temporalType: 'exact',
  startTime: '23:30',
  duration,
  createdAt: '2026-09-30T00:00:00.000Z',
  updatedAt: '2026-09-30T00:00:00.000Z',
});

describe('予定編集値の変換', () => {
  test('日付を日本語の月日と曜日で表示する', () => {
    expect(formatEditorDate('2026-09-25')).toBe('9月25日（金）');
  });

  test('日跨ぎの固定時間を終了日時へ変換する', () => {
    expect(getExactEditorRange(createExactEvent({ type: 'fixed', minutes: 1590 }))).toEqual({
      startDate: '2026-12-31',
      startTime: '23:30',
      endDate: '2027-01-02',
      endTime: '02:00',
    });
  });

  test.each(['instant', 'undetermined'] as const)(
    '%sは開始と終了が同じなら特殊durationを維持する',
    (type) => {
      expect(getEditorExactDuration({
        startDate: '2026-09-25',
        startTime: '10:00',
        endDate: '2026-09-25',
        endTime: '10:00',
      }, { type })).toEqual({ ok: true, value: { type } });
    },
  );

  test('開始日を移動すると終了日も同じ日数だけ移動する', () => {
    expect(moveEditorRangeStart({
      startDate: '2026-12-31',
      startTime: '23:30',
      endDate: '2027-01-02',
      endTime: '02:00',
    }, '2027-01-02')).toEqual({
      startDate: '2027-01-02',
      startTime: '23:30',
      endDate: '2027-01-04',
      endTime: '02:00',
    });
  });

  test('開始以前の終了日時は拒否する', () => {
    expect(getEditorExactDuration({
      startDate: '2026-09-25',
      startTime: '10:00',
      endDate: '2026-09-24',
      endTime: '11:00',
    }, null)).toEqual({
      ok: false,
      error: { field: 'duration', message: '終了時刻を開始時刻と異なる時刻にしてください' },
    });
  });
});

describe('繰り返し編集値の変換', () => {
  test.each([
    ['daily', 'daily'],
    ['monthly', 'monthly'],
    ['yearly', 'yearly'],
  ] as const)('%sの定型ルールを往復できる', (preset, frequency) => {
    const draft = getRecurrenceDraft({
      version: 1,
      frequency,
      interval: 1,
      weekdays: [],
      end: { type: 'never' },
    }, '2026-09-25');

    expect(draft.preset).toBe(preset);
    expect(buildRecurrenceRule(draft, '2026-09-25')).toEqual({
      ok: true,
      value: {
        version: 1,
        frequency,
        interval: 1,
        weekdays: [],
        end: { type: 'never' },
      },
    });
  });

  test('平日の定型ルールを判定する', () => {
    expect(getRecurrenceDraft({
      version: 1,
      frequency: 'weekly',
      interval: 1,
      weekdays: [1, 2, 3, 4, 5],
      end: { type: 'never' },
    }, '2026-09-25').preset).toBe('weekdays');
  });

  test('カスタムの不正な間隔と終了回数を拒否する', () => {
    const draft = getRecurrenceDraft(null, '2026-09-25');

    expect(buildRecurrenceRule({ ...draft, preset: 'custom', intervalText: '0' }, '2026-09-25')).toMatchObject({
      ok: false,
      error: { field: 'recurrenceInterval' },
    });
    expect(buildRecurrenceRule({
      ...draft,
      preset: 'custom',
      endType: 'count',
      countText: '1.5',
    }, '2026-09-25')).toMatchObject({
      ok: false,
      error: { field: 'recurrenceCount' },
    });
  });
});

describe('通知編集値の変換', () => {
  const reminders: readonly EventReminder[] = [
    { id: 'later', eventId: 'event-1', minutesBefore: 60, sortOrder: 1 },
    { id: 'first', eventId: 'event-1', minutesBefore: 10, sortOrder: 0 },
  ];

  test('保存順に編集値を復元して並べ替えられる', () => {
    const drafts = getReminderDrafts(reminders);
    expect(drafts).toEqual([
      { id: 'first', minutesBefore: 10 },
      { id: 'later', minutesBefore: 60 },
    ]);
    expect(moveReminderDraft(drafts, 1, -1)).toEqual([
      { id: 'later', minutesBefore: 60 },
      { id: 'first', minutesBefore: 10 },
    ]);
  });

  test('重複を除き保存順を採番する', () => {
    expect(buildEventReminders('event-1', [
      { id: 'first', minutesBefore: 30 },
      { id: 'duplicate', minutesBefore: 30 },
      { id: 'last', minutesBefore: 0 },
    ])).toEqual({
      ok: true,
      value: [
        { id: 'first', eventId: 'event-1', minutesBefore: 30, sortOrder: 0 },
        { id: 'last', eventId: 'event-1', minutesBefore: 0, sortOrder: 1 },
      ],
    });
  });
});
