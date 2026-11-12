import type {
  NotificationRepository,
  NotificationSnapshot,
} from '@/domain/notifications/ports';
import type { AppDatabase } from './database';
import {
  mapEventRow,
  mapReminderRow,
  mapRecurrenceExceptionRow,
  mapTemporalDefinitionRow,
  type EventRow,
  type ReminderRow,
  type RecurrenceExceptionRow,
  type TemporalDefinitionRow,
} from './row-mappers';
/** 予定と通知・例外を同じ接続のsnapshotで読み、UI向けの期間検索へ依存させない。 */
export class SqliteNotificationRepository implements NotificationRepository {
  constructor(private readonly database: AppDatabase) {}
  async getRevision(): Promise<number> {
    const row = await this.database.first<{ desired_revision: number }>(
      'SELECT desired_revision FROM notification_sync_state WHERE id=1',
    );
    if (!row || !Number.isSafeInteger(row.desired_revision))
      throw new Error('Invalid notification state');
    return row.desired_revision;
  }
  async readSnapshot(): Promise<NotificationSnapshot> {
    let snapshot!: NotificationSnapshot;
    await this.database.exclusiveTransaction(async (tx) => {
      const revision = await new SqliteNotificationRepository(tx).getRevision();
      const events = await tx.all<EventRow>('SELECT * FROM events ORDER BY id');
      const reminders = await tx.all<ReminderRow>(
        'SELECT * FROM event_reminders ORDER BY sort_order,id',
      );
      const exceptions = await tx.all<RecurrenceExceptionRow>(
        'SELECT * FROM recurrence_exceptions',
      );
      const definitions = await tx.all<TemporalDefinitionRow>(
        'SELECT * FROM temporal_definitions',
      );
      const parsed = reminders.map(mapReminderRow);
      snapshot = {
        revision,
        aggregates: events.map((row) => ({
          event: mapEventRow(row),
          reminders: parsed.filter((r) => r.eventId === row.id),
        })),
        exceptions: exceptions.map(mapRecurrenceExceptionRow),
        definitions: definitions.map(mapTemporalDefinitionRow),
      };
    });
    return snapshot;
  }
  async markApplied(revision: number, now: string): Promise<boolean> {
    const result = await this.database.run(
      'UPDATE notification_sync_state SET applied_revision=$revision,synced_at=$now,error_code=NULL WHERE id=1 AND desired_revision=$revision',
      { $revision: revision, $now: now },
    );
    return result.changes === 1;
  }
  async recordFailure(code: string): Promise<void> {
    await this.database.run(
      'UPDATE notification_sync_state SET error_code=$code WHERE id=1',
      { $code: code },
    );
  }
}
