import { parseTemporalDefinition } from '../temporal-definition';
import { createStandardTemporalDefinitions } from '../standard-definitions';

const now = '2026-09-08T00:00:00.000Z';
const calendarId = 'personal-default';

const expected = [
  ['morning', '朝', 'day', { kind: 'timeOfDay', startMinute: 360, endMinute: 600 }, 0.25, 0.25],
  ['am', '午前', 'day', { kind: 'timeOfDay', startMinute: 480, endMinute: 720 }, 0, 0],
  ['before_noon', '昼前', 'day', { kind: 'timeOfDay', startMinute: 630, endMinute: 720 }, 0.35, 0],
  ['around_noon', '昼ごろ', 'day', { kind: 'timeOfDay', startMinute: 690, endMinute: 810 }, 0.5, 0.5],
  ['early_afternoon', '昼過ぎ', 'day', { kind: 'timeOfDay', startMinute: 780, endMinute: 960 }, 0, 0.35],
  ['pm', '午後', 'day', { kind: 'timeOfDay', startMinute: 720, endMinute: 1020 }, 0, 0.35],
  ['evening', '夕方', 'day', { kind: 'timeOfDay', startMinute: 960, endMinute: 1140 }, 0.25, 0.25],
  ['night', '夜', 'day', { kind: 'timeOfDay', startMinute: 1080, endMinute: 1380 }, 0.25, 0.25],
  ['late_night', '深夜', 'day', { kind: 'timeOfDay', startMinute: 1320, endMinute: 1560 }, 0.25, 0.25],
  ['this_week_first_half', '今週前半', 'week', { kind: 'week', selectionWeekOffset: 0, startWeekday: 1, endWeekday: 3 }, 0, 0],
  ['this_week_second_half', '今週後半', 'week', { kind: 'week', selectionWeekOffset: 0, startWeekday: 4, endWeekday: 5 }, 0, 0],
  ['this_weekend', '今週末', 'week', { kind: 'week', selectionWeekOffset: 0, startWeekday: 6, endWeekday: 7 }, 0, 0],
  ['next_week', '来週', 'week', { kind: 'week', selectionWeekOffset: 1, startWeekday: 1, endWeekday: 7 }, 0, 0],
  ['next_week_first_half', '来週前半', 'week', { kind: 'week', selectionWeekOffset: 1, startWeekday: 1, endWeekday: 3 }, 0, 0],
  ['next_week_second_half', '来週後半', 'week', { kind: 'week', selectionWeekOffset: 1, startWeekday: 4, endWeekday: 7 }, 0, 0],
  ['week_after_next', '再来週', 'week', { kind: 'week', selectionWeekOffset: 2, startWeekday: 1, endWeekday: 7 }, 0, 0],
  ['month_start', '月初', 'month', { kind: 'monthDays', selectionMonthOffset: 0, startDay: 1, endDay: 5 }, 0, 0.35],
  ['month_first_third', '上旬', 'month', { kind: 'monthDays', selectionMonthOffset: 0, startDay: 1, endDay: 10 }, 0, 0],
  ['month_middle_third', '中旬', 'month', { kind: 'monthDays', selectionMonthOffset: 0, startDay: 11, endDay: 20 }, 0, 0],
  ['month_last_third', '下旬', 'month', { kind: 'monthDays', selectionMonthOffset: 0, startDay: 21, endDay: 'last' }, 0, 0],
  ['month_end', '月末', 'month', { kind: 'monthLastDays', selectionMonthOffset: 0, count: 5 }, 0.35, 0],
  ['next_month', '来月', 'month', { kind: 'monthDays', selectionMonthOffset: 1, startDay: 1, endDay: 'last' }, 0, 0],
] as const;

describe('createStandardTemporalDefinitions', () => {
  it('creates the complete agreed catalog in display order', () => {
    const definitions = createStandardTemporalDefinitions(calendarId, now);

    expect(definitions).toHaveLength(22);
    expect(definitions.map(({ key, label, granularity, resolverConfig, fadeInRatio, fadeOutRatio }) =>
      [key, label, granularity, resolverConfig, fadeInRatio, fadeOutRatio],
    )).toEqual(expected);
  });

  it('uses stable unique ids and valid enabled system definitions', () => {
    const definitions = createStandardTemporalDefinitions(calendarId, now);

    expect(new Set(definitions.map(({ id }) => id)).size).toBe(22);
    definitions.forEach((definition, index) => {
      expect(definition).toMatchObject({
        id: `${calendarId}:${definition.key}`,
        calendarId,
        isSystem: true,
        isEnabled: true,
        sortOrder: (index + 1) * 10,
        createdAt: now,
        updatedAt: now,
      });
      expect(parseTemporalDefinition(definition).ok).toBe(true);
    });
  });
});
