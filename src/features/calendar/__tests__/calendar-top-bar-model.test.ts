import { createCalendarTopBarModel } from '../calendar-top-bar-model';

describe('カレンダートップバーの表示モデル', () => {
  it('表示年が今年なら月名だけを表示する', () => {
    expect(createCalendarTopBarModel('2026-09-24', '2026-09-01')).toEqual({
      monthLabel: '9月',
      yearLabel: null,
      accessibilityLabel: '2026年9月、日付を選択',
    });
  });

  it('表示年が今年と異なる場合は年を補助表示する', () => {
    expect(createCalendarTopBarModel('2027-01-01', '2026-09-01')).toEqual({
      monthLabel: '1月',
      yearLabel: '2027',
      accessibilityLabel: '2027年1月、日付を選択',
    });
  });
});
