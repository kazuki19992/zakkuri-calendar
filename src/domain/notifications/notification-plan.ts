import { addDays, differenceInCalendarDays, format, parse } from 'date-fns';
import { expandEventOccurrences } from '@/domain/calendar/event-occurrence';
import { getReminderTiming } from '@/domain/calendar/event-reminder';
import type { CalendarEvent } from '@/domain/calendar/event';
import { notificationCategory, timingIsCompatible } from './reminder-timing';
import type { ReminderTiming } from './reminder-timing';
import {
  NOTIFICATION_PREFIX,
  type NotificationSnapshot,
  type PlannedNotification,
} from './ports';
export const NOTIFICATION_BUDGET = 60;
export const NOTIFICATION_HORIZON_DAYS = 366;
const date = (v: string) => parse(v, 'yyyy-MM-dd', new Date(2000, 0, 1));
const day = (v: Date) => format(v, 'yyyy-MM-dd');
/** Dateのcompatible規則によりDST欠落は先へ進め、重複は最初を採用する。 */
function wallTime(value: string, minutes: number): Date {
  const result = addDays(date(value), Math.floor(minutes / 1440));
  result.setHours(
    Math.floor((((minutes % 1440) + 1440) % 1440) / 60),
    ((minutes % 60) + 60) % 60,
    0,
    0,
  );
  return result;
}
export function reminderFireAt(
  event: CalendarEvent,
  timing: ReminderTiming,
  snapshot: NotificationSnapshot,
): number {
  if (!timingIsCompatible(timing, event, snapshot.definitions))
    throw new Error('incompatible_timing');
  const end = timing.kind !== 'legacyStartOffset' && timing.anchor === 'end';
  if (timing.kind === 'relativeDate') {
    const base =
      end && event.temporalType !== 'exact' ? event.endDate : event.anchorDate;
    const [hour, minute] = timing.time.split(':').map(Number);
    return wallTime(
      day(addDays(date(base), -timing.daysBefore)),
      hour * 60 + minute,
    ).getTime();
  }
  let minute = 0;
  if (event.temporalType === 'exact') {
    const [h, m] = event.startTime.split(':').map(Number);
    minute = h * 60 + m;
    if (end && event.duration.type === 'fixed')
      minute += event.duration.minutes;
  } else if (event.temporalType === 'fuzzy') {
    const config = snapshot.definitions.find(
      (d) => d.id === event.temporalDefinitionId,
    )?.resolverConfig;
    if (config?.kind === 'timeOfDay')
      minute = end ? config.endMinute : config.startMinute;
  }
  return wallTime(event.anchorDate, minute - timing.minutesBefore).getTime();
}
/** 表示範囲ではなく通知日時を選別し、例外を適用済みの開催だけを予約する。 */
export function planNotifications(snapshot: NotificationSnapshot, now: Date) {
  const requests: PlannedNotification[] = [],
    failures: string[] = [];
  const horizon = addDays(now, NOTIFICATION_HORIZON_DAYS).getTime();
  const replacementIds = new Set(
    snapshot.exceptions.map((e) => e.replacementEventId),
  );
  const aggregateById = new Map(
    snapshot.aggregates.map((a) => [a.event.id, a]),
  );
  const replacements = snapshot.aggregates
    .filter((a) => replacementIds.has(a.event.id))
    .map((a) => a.event);
  for (const aggregate of snapshot.aggregates) {
    if (replacementIds.has(aggregate.event.id)) continue;
    try {
      // 各系列のspanと例外の先行時間を含め、境界外開催の通知を落とさない。
      const involved = [
        aggregate,
        ...snapshot.exceptions
          .filter((e) => e.seriesEventId === aggregate.event.id)
          .flatMap((e) => aggregateById.get(e.replacementEventId ?? '') ?? []),
      ];
      if (involved.every(a => a.reminders.length === 0)) continue;
      const lead = Math.max(
        0,
        ...involved.flatMap((a) =>
          a.reminders.map((r) => {
            const t = getReminderTiming(r);
            return t.kind === 'relativeDate'
              ? t.daysBefore
              : Math.ceil(t.minutesBefore / 1440);
          }),
        ),
      );
      const span = Math.max(
        2,
        ...involved.map((a) =>
          a.event.temporalType === 'exact'
            ? a.event.duration.type === 'fixed'
              ? Math.ceil(a.event.duration.minutes / 1440)
              : 0
            : differenceInCalendarDays(
                date(a.event.endDate),
                date(a.event.anchorDate),
              ),
        ),
      );
      const from = day(addDays(now, -span - 2)),
        through = day(addDays(now, NOTIFICATION_HORIZON_DAYS + lead + 2));
      const expanded = expandEventOccurrences({
        snapshot: {
          events: [aggregate.event],
          exceptions: snapshot.exceptions.filter(
            (e) => e.seriesEventId === aggregate.event.id,
          ),
          replacementEvents: replacements,
        },
        from,
        through,
      });
      if (!expanded.ok) {
        failures.push(aggregate.event.id);
        continue;
      }
      for (const occurrence of expanded.value) {
        const identity = occurrence.occurrenceIdentity;
        const exception =
          identity &&
          snapshot.exceptions.find(
            (e) =>
              e.seriesEventId === identity.seriesEventId &&
              e.originalOccurrenceDate === identity.originalOccurrenceDate,
          );
        const effective =
          exception && exception.overrideFields.includes('reminders')
            ? aggregateById.get(exception.replacementEventId ?? '')
            : aggregate;
        const seen = new Set<number>();
        for (const reminder of [...(effective?.reminders ?? [])].sort((a, b) =>
          a.id.localeCompare(b.id),
        )) {
          try {
            const timedEvent = {
              ...occurrence.event,
              anchorDate: occurrence.occurrenceStartDate,
              ...(occurrence.event.temporalType !== 'exact'
                ? { endDate: occurrence.occurrenceThroughDate }
                : {}),
            } as CalendarEvent;
            const fireAt = reminderFireAt(
              timedEvent,
              getReminderTiming(reminder),
              snapshot,
            );
            if (!Number.isFinite(fireAt)) throw new Error('invalid_date');
            if (fireAt <= now.getTime() || fireAt > horizon || seen.has(fireAt))
              continue;
            seen.add(fireAt);
            const key = JSON.stringify([
              identity?.seriesEventId ?? aggregate.event.id,
              identity?.originalOccurrenceDate ?? null,
              reminder.id,
            ]);
            const identifier = NOTIFICATION_PREFIX + encodeURIComponent(key);
            const target = identity
              ? {
                  eventId: identity.seriesEventId,
                  occurrenceDate: identity.originalOccurrenceDate,
                }
              : { eventId: aggregate.event.id };
            const category = notificationCategory(
              timedEvent,
              snapshot.definitions,
            );
            const label = `${occurrence.occurrenceStartDate} ${category === 'exact' && timedEvent.temporalType === 'exact' ? timedEvent.startTime : category === 'all_day' ? '終日' : timedEvent.temporalType === 'fuzzy' ? (snapshot.definitions.find((d) => d.id === timedEvent.temporalDefinitionId)?.label ?? '') : ''}`;
            const fingerprint = JSON.stringify([
              fireAt,
              timedEvent.title,
              label,
              target,
            ]);
            requests.push({
              identifier,
              key,
              fireAt,
              title: timedEvent.title,
              label,
              target,
              fingerprint,
            });
          } catch {
            failures.push(reminder.id);
          }
        }
      }
    } catch {
      failures.push(aggregate.event.id);
    }
  }
  requests.sort((a, b) => a.fireAt - b.fireAt || a.key.localeCompare(b.key));
  return {
    requests: requests.slice(0, NOTIFICATION_BUDGET),
    failures,
    deferred:
      requests.length > NOTIFICATION_BUDGET ||
      snapshot.aggregates.some(
        (a) =>
          a.reminders.length > 0 &&
          (a.event.recurrenceRule?.end.type === 'never' ||
            a.event.anchorDate > day(new Date(horizon))),
      ),
  };
}
