import { rangeForExactDuration } from '../exact-duration-draft';

describe('予定の初期長から日時範囲を作る', () => {
  it('年末と日付を跨いで壁時計の終了を作る', () => {
    expect(rangeForExactDuration('2026-12-31', '23:30', { type: 'fixed', minutes: 90 }))
      .toEqual({ startDate: '2026-12-31', startTime: '23:30', endDate: '2027-01-01', endTime: '01:00' });
  });
  it.each(['instant', 'undetermined'] as const)('非fixedの%sは開始と同じ範囲を持つ', (type) => {
    expect(rangeForExactDuration('2026-12-31', '23:30', { type })).toMatchObject({ endDate: '2026-12-31', endTime: '23:30' });
  });
});
