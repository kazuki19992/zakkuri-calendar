import type { TemporalDefinition } from '../temporal-definition';
import { resolveRelativeDateRange } from '../relative-date-resolution';

const base = {
  id: 'personal-default:relative', calendarId: 'personal-default', key: 'relative', label: '相対',
  fadeInRatio: 0, fadeOutRatio: 0, isSystem: true, isEnabled: true, sortOrder: 10,
  createdAt: '2026-09-30T00:00:00.000Z', updatedAt: '2026-09-30T00:00:00.000Z',
} as const;

function definition(fields: Pick<TemporalDefinition, 'granularity' | 'resolverConfig'>): TemporalDefinition {
  return { ...base, ...fields };
}

describe('resolveRelativeDateRange', () => {
  it('月末をまたぐ来週前半を月曜始まりで解決する', () => {
    const result = resolveRelativeDateRange('2026-09-30', definition({
      granularity: 'week',
      resolverConfig: { kind: 'week', selectionWeekOffset: 1, startWeekday: 1, endWeekday: 3 },
    }), 5);

    expect(result).toEqual({ ok: true, value: {
      referenceDate: '2026-09-30', periodAnchorDate: '2026-10-05',
      startDate: '2026-10-05', endDate: '2026-10-07', parameterSnapshot: {},
    } });
  });

  it.each([
    [5, '2026-10-02'], [6, '2026-10-03'], [7, '2026-10-04'],
  ] as const)('今週中を締切曜日%dまで解決する', (deadline, endDate) => {
    expect(resolveRelativeDateRange('2026-09-30', definition({
      granularity: 'week', resolverConfig: { kind: 'weekRemainder', selectionWeekOffset: 0 },
    }), deadline)).toEqual({ ok: true, value: {
      referenceDate: '2026-09-30', periodAnchorDate: '2026-09-28',
      startDate: '2026-09-30', endDate, parameterSnapshot: { thisWeekDeadlineWeekday: deadline },
    } });
  });

  it('締切後の今週中は基準日だけにする', () => {
    expect(resolveRelativeDateRange('2026-10-03', definition({
      granularity: 'week', resolverConfig: { kind: 'weekRemainder', selectionWeekOffset: 0 },
    }), 5)).toMatchObject({ ok: true, value: {
      startDate: '2026-10-03', endDate: '2026-10-03',
      parameterSnapshot: { thisWeekDeadlineWeekday: 5 },
    } });
  });

  it.each([
    [{ kind: 'monthDays', selectionMonthOffset: 0, startDay: 21, endDay: 'last' }, '2028-02-21', '2028-02-29'],
    [{ kind: 'monthLastDays', selectionMonthOffset: 0, count: 5 }, '2028-02-25', '2028-02-29'],
    [{ kind: 'monthDays', selectionMonthOffset: 1, startDay: 1, endDay: 'last' }, '2027-01-01', '2027-01-31'],
  ] as const)('月定義を月末と年末を越えて解決する', (resolverConfig, startDate, endDate) => {
    const referenceDate = resolverConfig.selectionMonthOffset === 1 ? '2026-12-20' : '2028-02-14';
    expect(resolveRelativeDateRange(referenceDate, definition({ granularity: 'month', resolverConfig }), 5))
      .toMatchObject({ ok: true, value: { startDate, endDate } });
  });

  it('日内定義と不正日付を拒否する', () => {
    const day = definition({ granularity: 'day', resolverConfig: { kind: 'timeOfDay', startMinute: 360, endMinute: 600 } });
    expect(resolveRelativeDateRange('2026-09-30', day, 5).ok).toBe(false);
    expect(resolveRelativeDateRange('2026-02-30', definition({
      granularity: 'week', resolverConfig: { kind: 'week', selectionWeekOffset: 0, startWeekday: 1, endWeekday: 3 },
    }), 5).ok).toBe(false);
  });
});
