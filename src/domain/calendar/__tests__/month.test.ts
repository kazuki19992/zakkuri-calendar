import { getMonthGrid, getMonthRange, moveMonth } from '../month';

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

  it('月曜始まりの42日を壁時計日付で返す', () => {
    const grid = getMonthGrid('2026-09-01', 1);

    expect(grid).toHaveLength(42);
    expect(grid[0]?.date).toBe('2026-08-31');
    expect(grid[41]?.date).toBe('2026-10-11');
  });
});
