import { parseRecurrenceRule } from '../recurrence';

const weekly = {
  version: 1,
  frequency: 'weekly' as const,
  interval: 2,
  weekdays: [1, 3],
  end: { type: 'count' as const, count: 8 },
};

describe('繰り返し規則', () => {
  it('有効な週次規則を受け付ける', () => {
    expect(parseRecurrenceRule(weekly)).toEqual({ ok: true, value: weekly });
  });

  it.each([
    ['0の間隔', { ...weekly, interval: 0 }],
    ['不正な曜日', { ...weekly, weekdays: [1, 7] }],
    ['不正なfrequency', { ...weekly, frequency: 'fortnightly' }],
    ['実在しない終了日', { ...weekly, end: { type: 'until', date: '2026-02-30' } }],
    ['0の終了回数', { ...weekly, end: { type: 'count', count: 0 } }],
    ['未知のversion', { ...weekly, version: 2 }],
  ])('%sを拒否する', (_, rule) => {
    expect(parseRecurrenceRule(rule).ok).toBe(false);
  });

  it('週次の曜日を重複なしの昇順へ正規化する', () => {
    expect(parseRecurrenceRule({ ...weekly, weekdays: [3, 1, 3, 0] })).toEqual({
      ok: true,
      value: { ...weekly, weekdays: [0, 1, 3] },
    });
  });

  it('週次以外の曜日を空配列へ正規化する', () => {
    expect(parseRecurrenceRule({ ...weekly, frequency: 'daily', weekdays: [1, 3] })).toEqual({
      ok: true,
      value: { ...weekly, frequency: 'daily', weekdays: [] },
    });
  });
});
