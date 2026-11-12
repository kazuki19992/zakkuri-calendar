import type { EventRepository } from '@/domain/calendar/repositories';
import type { NotificationTarget } from '@/domain/notifications/ports';
export { parseNotificationTarget } from '@/domain/notifications/notification-target';
/** 移動例外は元開催identityで開き、消えた系列を別の系列と推測して開かない。 */
export async function resolveNotificationTarget(
  target: NotificationTarget,
  repository: Pick<EventRepository, 'getById' | 'getOccurrenceEditData'>,
): Promise<NotificationTarget | null> {
  if (target.occurrenceDate) {
    const occurrence = await repository.getOccurrenceEditData({
      seriesEventId: target.eventId,
      originalOccurrenceDate: target.occurrenceDate,
    });
    return occurrence && occurrence.exception?.kind !== 'deleted'
      ? target
      : null;
  }
  const aggregate = await repository.getById(target.eventId);
  return aggregate && aggregate.event.recurrenceRule === null ? target : null;
}
