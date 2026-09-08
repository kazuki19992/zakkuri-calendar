import { parseTemporalDefinition } from '../temporal-definition';

const base = {
  id: 'personal-default:morning',
  calendarId: 'personal-default',
  key: 'morning',
  label: '朝',
  granularity: 'day' as const,
  resolverConfig: { kind: 'timeOfDay' as const, startMinute: 360, endMinute: 600 },
  fadeInRatio: 0.25,
  fadeOutRatio: 0.25,
  isSystem: true,
  isEnabled: true,
  sortOrder: 10,
  createdAt: '2026-09-08T00:00:00.000Z',
  updatedAt: '2026-09-08T00:00:00.000Z',
};

describe('parseTemporalDefinition', () => {
  it('accepts a validated day definition', () => {
    expect(parseTemporalDefinition(base)).toEqual({ ok: true, value: base });
  });

  it.each([
    { granularity: 'week', resolverConfig: { kind: 'week', selectionWeekOffset: 1, startWeekday: 1, endWeekday: 7 } },
    { granularity: 'month', resolverConfig: { kind: 'monthDays', selectionMonthOffset: 0, startDay: 1, endDay: 'last' } },
    { granularity: 'month', resolverConfig: { kind: 'monthLastDays', selectionMonthOffset: 1, count: 5 } },
  ])('accepts a valid $granularity resolver', (fields) => {
    expect(parseTemporalDefinition({ ...base, ...fields }).ok).toBe(true);
  });

  it.each([[-0.1, 0.2], [0.2, 1.1], [0.6, 0.5]])(
    'rejects invalid fade ratios',
    (fadeInRatio, fadeOutRatio) => {
      expect(parseTemporalDefinition({ ...base, fadeInRatio, fadeOutRatio }).ok).toBe(false);
    },
  );

  it('rejects non-finite fade ratios', () => {
    expect(parseTemporalDefinition({ ...base, fadeInRatio: Number.NaN }).ok).toBe(false);
  });

  it('accepts a cross-midnight time range', () => {
    expect(
      parseTemporalDefinition({
        ...base,
        key: 'late_night',
        resolverConfig: { kind: 'timeOfDay', startMinute: 1320, endMinute: 1560 },
      }).ok,
    ).toBe(true);
  });

  it.each(['id', 'calendarId', 'key', 'label', 'createdAt', 'updatedAt'] as const)(
    'rejects blank %s',
    (field) => {
      expect(parseTemporalDefinition({ ...base, [field]: '   ' }).ok).toBe(false);
    },
  );

  it.each([
    { resolverConfig: { kind: 'week' } },
    { resolverConfig: { kind: 'timeOfDay', startMinute: 1.5, endMinute: 20 } },
    { resolverConfig: { kind: 'monthDays', selectionMonthOffset: 0, startDay: 0, endDay: 4 } },
    { resolverConfig: { kind: 'monthLastDays', selectionMonthOffset: 0, count: 0 } },
    { sortOrder: 1.2 },
  ])('rejects malformed integer-bound values', (fields) => {
    expect(parseTemporalDefinition({ ...base, ...fields }).ok).toBe(false);
  });
});
