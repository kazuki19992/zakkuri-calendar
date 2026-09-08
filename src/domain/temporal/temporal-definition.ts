import type { Result } from '@/domain/shared/result';

export type TemporalGranularity = 'day' | 'week' | 'month';

export type TimeOfDayResolver = Readonly<{
  kind: 'timeOfDay';
  startMinute: number;
  endMinute: number;
}>;

export type WeekResolver = Readonly<{
  kind: 'week';
  selectionWeekOffset: 0 | 1 | 2;
  startWeekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  endWeekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
}>;

export type MonthDaysResolver = Readonly<{
  kind: 'monthDays';
  selectionMonthOffset: 0 | 1;
  startDay: number;
  endDay: number | 'last';
}>;

export type MonthLastDaysResolver = Readonly<{
  kind: 'monthLastDays';
  selectionMonthOffset: 0 | 1;
  count: number;
}>;

export type TemporalResolverConfig =
  | TimeOfDayResolver
  | WeekResolver
  | MonthDaysResolver
  | MonthLastDaysResolver;

export type TemporalDefinition = Readonly<{
  id: string;
  calendarId: string;
  key: string;
  label: string;
  granularity: TemporalGranularity;
  resolverConfig: TemporalResolverConfig;
  fadeInRatio: number;
  fadeOutRatio: number;
  isSystem: boolean;
  isEnabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}>;

export type TemporalDefinitionValidationError = Readonly<{
  field: string;
  message: string;
}>;

const fail = (field: string, message: string): Result<never, TemporalDefinitionValidationError> => ({
  ok: false,
  error: { field, message },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const isNonBlankString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const isIntegerIn = (value: unknown, minimum: number, maximum: number): value is number =>
  Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum;

function parseResolver(
  value: unknown,
  granularity: TemporalGranularity,
): Result<TemporalResolverConfig, TemporalDefinitionValidationError> {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    return fail('resolverConfig', 'resolverConfig must be an object with a kind');
  }

  if (value.kind === 'timeOfDay') {
    if (
      granularity !== 'day' ||
      !isIntegerIn(value.startMinute, 0, 1439) ||
      !isIntegerIn(value.endMinute, 1, 2879) ||
      value.endMinute <= value.startMinute ||
      value.endMinute - value.startMinute > 1440
    ) {
      return fail('resolverConfig', 'invalid timeOfDay resolver');
    }
    return { ok: true, value: { kind: 'timeOfDay', startMinute: value.startMinute, endMinute: value.endMinute } };
  }

  if (value.kind === 'week') {
    if (
      granularity !== 'week' ||
      !isIntegerIn(value.selectionWeekOffset, 0, 2) ||
      !isIntegerIn(value.startWeekday, 1, 7) ||
      !isIntegerIn(value.endWeekday, 1, 7) ||
      value.endWeekday < value.startWeekday
    ) {
      return fail('resolverConfig', 'invalid week resolver');
    }
    return {
      ok: true,
      value: {
        kind: 'week',
        selectionWeekOffset: value.selectionWeekOffset as 0 | 1 | 2,
        startWeekday: value.startWeekday as WeekResolver['startWeekday'],
        endWeekday: value.endWeekday as WeekResolver['endWeekday'],
      },
    };
  }

  if (value.kind === 'monthDays') {
    const endDayValid = value.endDay === 'last' || isIntegerIn(value.endDay, 1, 31);
    if (
      granularity !== 'month' ||
      !isIntegerIn(value.selectionMonthOffset, 0, 1) ||
      !isIntegerIn(value.startDay, 1, 31) ||
      !endDayValid ||
      (typeof value.endDay === 'number' && value.endDay < value.startDay)
    ) {
      return fail('resolverConfig', 'invalid monthDays resolver');
    }
    return {
      ok: true,
      value: {
        kind: 'monthDays',
        selectionMonthOffset: value.selectionMonthOffset as 0 | 1,
        startDay: value.startDay,
        endDay: value.endDay as number | 'last',
      },
    };
  }

  if (value.kind === 'monthLastDays') {
    if (
      granularity !== 'month' ||
      !isIntegerIn(value.selectionMonthOffset, 0, 1) ||
      !isIntegerIn(value.count, 1, 31)
    ) {
      return fail('resolverConfig', 'invalid monthLastDays resolver');
    }
    return {
      ok: true,
      value: {
        kind: 'monthLastDays',
        selectionMonthOffset: value.selectionMonthOffset as 0 | 1,
        count: value.count,
      },
    };
  }

  return fail('resolverConfig', 'unknown resolver kind');
}

export function parseTemporalDefinition(
  input: unknown,
): Result<TemporalDefinition, TemporalDefinitionValidationError> {
  if (!isRecord(input)) return fail('definition', 'definition must be an object');

  for (const field of ['id', 'calendarId', 'key', 'label', 'createdAt', 'updatedAt'] as const) {
    if (!isNonBlankString(input[field])) return fail(field, `${field} must not be blank`);
  }

  const id = input.id as string;
  const calendarId = input.calendarId as string;
  const key = input.key as string;
  const label = input.label as string;
  const createdAt = input.createdAt as string;
  const updatedAt = input.updatedAt as string;

  if (input.granularity !== 'day' && input.granularity !== 'week' && input.granularity !== 'month') {
    return fail('granularity', 'invalid granularity');
  }
  if (
    typeof input.fadeInRatio !== 'number' ||
    !Number.isFinite(input.fadeInRatio) ||
    input.fadeInRatio < 0 ||
    input.fadeInRatio > 1
  ) {
    return fail('fadeInRatio', 'fadeInRatio must be between 0 and 1');
  }
  if (
    typeof input.fadeOutRatio !== 'number' ||
    !Number.isFinite(input.fadeOutRatio) ||
    input.fadeOutRatio < 0 ||
    input.fadeOutRatio > 1
  ) {
    return fail('fadeOutRatio', 'fadeOutRatio must be between 0 and 1');
  }
  if (input.fadeInRatio + input.fadeOutRatio > 1) {
    return fail('fadeRatios', 'fade ratios must sum to at most 1');
  }
  if (typeof input.isSystem !== 'boolean' || typeof input.isEnabled !== 'boolean') {
    return fail('flags', 'system and enabled flags must be boolean');
  }
  if (!isIntegerIn(input.sortOrder, 0, Number.MAX_SAFE_INTEGER)) {
    return fail('sortOrder', 'sortOrder must be a non-negative integer');
  }

  const resolver = parseResolver(input.resolverConfig, input.granularity);
  if (!resolver.ok) return resolver;

  return {
    ok: true,
    value: {
      id,
      calendarId,
      key,
      label,
      granularity: input.granularity,
      resolverConfig: resolver.value,
      fadeInRatio: input.fadeInRatio,
      fadeOutRatio: input.fadeOutRatio,
      isSystem: input.isSystem,
      isEnabled: input.isEnabled,
      sortOrder: input.sortOrder,
      createdAt,
      updatedAt,
    },
  };
}
