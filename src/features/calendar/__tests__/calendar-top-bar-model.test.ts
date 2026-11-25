import { createCalendarTopBarModel } from '../calendar-top-bar-model';

describe('カレンダートップバーの表示モデル', () => {
  it('月表示では今年でも年月を表示する', () => {
    expect(createCalendarTopBarModel('2026-09-24', '2026-09-01')).toEqual({
      monthLabel: '9月',
      yearLabel: '2026年',
      accessibilityLabel: '2026年9月、年月を選択',
    });
  });

  it('表示年が今年と異なる場合は年を補助表示する', () => {
    expect(createCalendarTopBarModel('2027-01-01', '2026-09-01')).toEqual({
      monthLabel: '1月',
      yearLabel: '2027年',
      accessibilityLabel: '2027年1月、年月を選択',
    });
  });
});
