import {
  getMonthGrid,
  getMonthRange,
  getMonthStart,
  getTwoDayRange,
  moveMonth,
  moveTwoDayWindow,
  offsetCalendarDate,
  toCalendarDate,
} from '../month';

describe('月カレンダーの日付計算', () => {
  it('閏年2月の月初と月末を返す', () => {
    expect(getMonthRange('2028-02-14')).toEqual({
      from: '2028-02-01',
      through: '2028-02-29',
    });
  });

  it('年境界を越えて前月と次月へ移動する', () => {
    expect(moveMonth('2026-01-01', -1)).toBe('2025-12-01');
    expect(moveMonth('2026-12-01', 1)).toBe('2027-01-01');
  });

  it('2日表示の範囲を月境界を越えて返す', () => {
    expect(getTwoDayRange('2026-09-30')).toEqual({
      from: '2026-09-30',
      through: '2026-10-01',
    });
  });

  it('2日表示の基準日を1日単位で前後へ移動する', () => {
    expect(moveTwoDayWindow('2026-09-30', 1)).toBe('2026-10-01');
    expect(moveTwoDayWindow('2026-09-30', -1)).toBe('2026-09-29');
  });

  it('任意の日数だけ月・年境界を越えて日付をずらす', () => {
    expect(offsetCalendarDate('2026-09-30', 2)).toBe('2026-10-02');
    expect(offsetCalendarDate('2026-01-01', -2)).toBe('2025-12-30');
    expect(offsetCalendarDate('2026-09-08', 0)).toBe('2026-09-08');
  });

  it('月曜始まりの42日を壁時計日付で返す', () => {
    const grid = getMonthGrid('2026-09-01', 1);

    expect(grid).toHaveLength(42);
    expect(grid[0]?.date).toBe('2026-08-31');
    expect(grid[41]?.date).toBe('2026-10-11');
  });

  it('時差で前日になる時刻も端末の壁時計日付として返す', () => {
    expect(toCalendarDate(new Date(2026, 8, 8, 0, 30))).toBe('2026-09-08');
    expect(getMonthStart('2026-09-30')).toBe('2026-09-01');
  });

  it('日曜始まりのグリッド属性を月境界でも正しく返す', () => {
    const grid = getMonthGrid('2026-02-15', 0);

    expect(grid).toHaveLength(42);
    expect(grid[0]).toEqual({
      date: '2026-02-01',
      dayNumber: 1,
      weekday: 0,
      isCurrentMonth: true,
    });
    expect(grid[41]).toEqual({
      date: '2026-03-14',
      dayNumber: 14,
      weekday: 6,
      isCurrentMonth: false,
    });
  });
});
