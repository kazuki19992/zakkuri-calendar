import { isCalendarDate } from '@/domain/calendar/month';
import type { NotificationTarget } from './ports';
/** 外部payloadをURLとして実行せず、保存予定を識別する値だけを受け取る。 */
export function parseNotificationTarget(
  input: unknown,
): NotificationTarget | null {
  if (typeof input !== 'object' || input === null) return null;
  const v = input as Record<string, unknown>;
  if (v.version !== 1 || typeof v.eventId !== 'string' || !v.eventId.trim())
    return null;
  if (
    v.occurrenceDate !== undefined &&
    (typeof v.occurrenceDate !== 'string' || !isCalendarDate(v.occurrenceDate))
  )
    return null;
  return {
    eventId: v.eventId,
    ...(typeof v.occurrenceDate === 'string'
      ? { occurrenceDate: v.occurrenceDate }
      : {}),
  };
}
