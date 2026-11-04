import { adjustThisWeekDeadline } from '../adjust-this-week-deadline';
import type { RelativeDateResolution } from '../relative-date-resolution';

const resolution: RelativeDateResolution = {
  referenceDate: '2026-03-16', periodAnchorDate: '2026-03-16',
  startDate: '2026-03-16', endDate: '2026-03-20', parameterSnapshot: { thisWeekDeadlineWeekday: 5 },
};
const policy = { version: 1, calendarId: 'jp', adjustThisWeekDeadline: true } as const;
const holidays = { status: 'available', holidays: [{ date: '2026-03-20', name: '春分の日' }] } as const;

describe('今週中の締切調整', () => {
  it('年境界の連休も暦日で探索して期間の開始日は維持する', () => {
    const acrossYear = { ...resolution, referenceDate: '2026-12-28', startDate: '2026-12-28', periodAnchorDate: '2026-12-28', endDate: '2027-01-03' };
    expect(adjustThisWeekDeadline(acrossYear, policy, { status: 'available', holidays: [{ date: '2027-01-01', name: '元日' }] }))
      .toMatchObject({ ok: true, value: { startDate: '2026-12-28', endDate: '2026-12-31' } });
  });
  it('平日の締切は同じ日を維持し、調整policyだけ記録する', () => {
    expect(adjustThisWeekDeadline(resolution, policy, { status: 'available', holidays: [] }))
      .toMatchObject({ ok: true, value: { endDate: '2026-03-20', parameterSnapshot: { deadlineAdjustment: { calendarId: 'jp' } } } });
  });
  it('祝日の金曜締切を木曜へ戻して調整理由を保存する', () => {
    expect(adjustThisWeekDeadline(resolution, policy, holidays)).toMatchObject({ ok: true, value: {
      startDate: '2026-03-16', endDate: '2026-03-19', parameterSnapshot: {
        thisWeekDeadlineWeekday: 5, deadlineAdjustment: { version: 1, calendarId: 'jp', unadjustedDeadlineDate: '2026-03-20' },
      },
    } });
  });
  it('祝日無効では土日だけを除外する', () => {
    expect(adjustThisWeekDeadline({ ...resolution, endDate: '2026-03-22' }, { ...policy, calendarId: 'none' }, holidays))
      .toMatchObject({ ok: true, value: { endDate: '2026-03-20' } });
  });
  it('基準日以前へ戻さず対象なしを返す', () => {
    expect(adjustThisWeekDeadline({ ...resolution, referenceDate: '2026-03-20', startDate: '2026-03-20' }, policy, holidays))
      .toEqual({ ok: false, error: 'noBusinessDay' });
  });
  it('未対応祝日を通常日として確定しない', () => {
    expect(adjustThisWeekDeadline(resolution, policy, { status: 'unsupported' }))
      .toEqual({ ok: false, error: 'unsupportedHolidayRange' });
  });
  it('調整OFFは未対応でも元期間を維持する', () => {
    expect(adjustThisWeekDeadline(resolution, { ...policy, adjustThisWeekDeadline: false }, { status: 'unsupported' }))
      .toEqual({ ok: true, value: resolution });
  });
});
