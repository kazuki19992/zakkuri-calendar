import type { CalendarEvent } from '@/domain/calendar/event';
import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';
export type ReminderTiming = Readonly<
  { version: 1 } & (
    | {
        kind: 'relativeMinutes';
        anchor: 'start' | 'end';
        minutesBefore: number;
      }
    | {
        kind: 'relativeDate';
        anchor: 'start' | 'end';
        daysBefore: number;
        time: string;
      }
    | { kind: 'legacyStartOffset'; minutesBefore: number }
  )
>;
export type NotificationCategory =
  | 'exact'
  | 'all_day'
  | 'fuzzy_day'
  | 'fuzzy_period';
export const NOTIFICATION_CATEGORIES: readonly NotificationCategory[] = [
  'exact',
  'all_day',
  'fuzzy_day',
  'fuzzy_period',
];
export const MAX_REMINDER_MINUTES = 365 * 1440 + 1439;
const integer = (v: unknown, max = Number.MAX_SAFE_INTEGER): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= max;
/** 保存形式のキー順や余分なプロパティを正規化し、未知versionを予定へ流さない。 */
export function parseReminderTiming(value: unknown): ReminderTiming | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (v.version !== 1) return null;
  if (v.kind === 'legacyStartOffset' && integer(v.minutesBefore))
    return { version: 1, kind: v.kind, minutesBefore: v.minutesBefore };
  if (v.anchor !== 'start' && v.anchor !== 'end') return null;
  if (
    v.kind === 'relativeMinutes' &&
    integer(v.minutesBefore, MAX_REMINDER_MINUTES)
  )
    return {
      version: 1,
      kind: v.kind,
      anchor: v.anchor,
      minutesBefore: v.minutesBefore,
    };
  if (
    v.kind === 'relativeDate' &&
    integer(v.daysBefore, 365) &&
    typeof v.time === 'string' &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(v.time)
  )
    return {
      version: 1,
      kind: v.kind,
      anchor: v.anchor,
      daysBefore: v.daysBefore,
      time: v.time,
    };
  return null;
}
export function defaultReminderTiming(
  category: NotificationCategory,
): ReminderTiming {
  if (category === 'exact' || category === 'fuzzy_day')
    return {
      version: 1,
      kind: 'relativeMinutes',
      anchor: category === 'exact' ? 'start' : 'end',
      minutesBefore: category === 'exact' ? 10 : 60,
    };
  return {
    version: 1,
    kind: 'relativeDate',
    anchor: category === 'all_day' ? 'start' : 'end',
    daysBefore: category === 'all_day' ? 0 : 1,
    time: '09:00',
  };
}
export function notificationCategory(
  event: Pick<CalendarEvent, 'temporalType'> & {
    temporalDefinitionId?: string;
  },
  definitions: readonly TemporalDefinition[],
): NotificationCategory {
  if (event.temporalType === 'exact') return 'exact';
  if (event.temporalType === 'allDay') return 'all_day';
  return definitions.find((d) => d.id === event.temporalDefinitionId)
    ?.resolverConfig.kind === 'timeOfDay'
    ? 'fuzzy_day'
    : 'fuzzy_period';
}
export function defaultTimingIsValid(
  category: NotificationCategory,
  timing: ReminderTiming,
): boolean {
  const expected = defaultReminderTiming(category);
  return (
    timing.kind === expected.kind &&
    timing.kind !== 'legacyStartOffset' &&
    expected.kind !== 'legacyStartOffset' &&
    timing.anchor === expected.anchor
  );
}
export function timingIsCompatible(
  timing: ReminderTiming,
  event: CalendarEvent,
  definitions: readonly TemporalDefinition[],
): boolean {
  const category = notificationCategory(event, definitions);
  const definition =
    event.temporalType === 'fuzzy'
      ? definitions.find((d) => d.id === event.temporalDefinitionId)
      : null;
  if (event.temporalType === 'fuzzy' && !definition) return false;
  if (timing.kind === 'legacyStartOffset') return true;
  if (timing.kind === 'relativeDate')
    return category === 'all_day' || category === 'fuzzy_period';
  return (
    (category === 'exact' || category === 'fuzzy_day') &&
    (timing.anchor === 'start' ||
      event.temporalType !== 'exact' ||
      event.duration.type === 'fixed')
  );
}
export function minutesLabel(minutes: number): string {
  if (minutes === 0) return '時刻';
  const days = Math.floor(minutes / 1440),
    hours = Math.floor((minutes % 1440) / 60),
    mins = minutes % 60;
  return `${days ? `${days}日` : ''}${hours ? `${hours}時間` : ''}${mins ? `${mins}分` : ''}前`;
}
export function timingLabel(timing: ReminderTiming, dateOnly = false): string {
  if (timing.kind === 'legacyStartOffset')
    return `${dateOnly ? '開始日0:00の' : '開始'}${minutesLabel(timing.minutesBefore)}（以前の設定）`;
  const anchor = timing.anchor === 'start' ? '開始' : '終了';
  if (timing.kind === 'relativeMinutes')
    return `${anchor}${minutesLabel(timing.minutesBefore)}`;
  return `${anchor}日${timing.daysBefore === 0 ? 'の' : timing.daysBefore === 1 ? 'の前日' : `の${timing.daysBefore}日前`}${timing.time}`;
}

/** 旧入力や種別変更後の値を、利用者が確定するまで保存せず編集候補へ変換する。 */
export function editableReminderTiming(
  timing: ReminderTiming | null,
  category: NotificationCategory,
): Exclude<ReminderTiming, { kind: 'legacyStartOffset' }> {
  const fallback = defaultReminderTiming(category) as Exclude<
    ReminderTiming,
    { kind: 'legacyStartOffset' }
  >;
  if (!timing) return fallback;
  if (timing.kind === fallback.kind)
    return timing as Exclude<ReminderTiming, { kind: 'legacyStartOffset' }>;
  if (timing.kind === 'legacyStartOffset') {
    if (fallback.kind === 'relativeMinutes')
      return {
        ...fallback,
        anchor: 'start',
        minutesBefore: Math.min(timing.minutesBefore, MAX_REMINDER_MINUTES),
      };
    const daysBefore = Math.min(365, Math.ceil(timing.minutesBefore / 1440));
    const minute = (1440 - (timing.minutesBefore % 1440)) % 1440;
    return {
      ...fallback,
      anchor: 'start',
      daysBefore,
      time: `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`,
    };
  }
  return fallback;
}
