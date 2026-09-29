import type { EventRepository } from '@/domain/calendar/repositories';
import { parseCalendarEvent, type CalendarEvent } from '@/domain/calendar/event';
import {
  normalizeEventReminders,
  type EventAggregate,
  type EventReminder,
} from '@/domain/calendar/event-reminder';
import type { AppDatabase, AppDatabaseParameters } from './database';
import { mapEventRow, mapReminderRow, type EventRow, type ReminderRow } from './row-mappers';

type NormalizedEventAggregate = Readonly<{
  event: CalendarEvent;
  reminders: readonly EventReminder[];
}>;

function eventParameters(event: CalendarEvent): AppDatabaseParameters {
  let temporalDefinitionId: string | null = null;
  let startTime: string | null = null;
  let durationType: string | null = null;
  let durationMinutes: number | null = null;
  let endDate: string | null = null;
  if (event.temporalType === 'exact') {
    startTime = event.startTime;
    durationType = event.duration.type;
    durationMinutes = event.duration.type === 'fixed' ? event.duration.minutes : null;
  } else if (event.temporalType === 'fuzzy') {
    temporalDefinitionId = event.temporalDefinitionId;
  } else {
    endDate = event.endDate;
  }
  return {
    $id: event.id,
    $calendarId: event.calendarId,
    $title: event.title,
    $temporalType: event.temporalType,
    $anchorDate: event.anchorDate,
    $temporalDefinitionId: temporalDefinitionId,
    $startTime: startTime,
    $durationType: durationType,
    $durationMinutes: durationMinutes,
    $endDate: endDate,
    $location: event.location,
    $notes: event.notes,
    $colorId: event.colorId,
    $recurrenceRuleJson: event.recurrenceRule === null ? null : JSON.stringify(event.recurrenceRule),
    $createdTimeZoneId: event.createdTimeZoneId,
    $createdAt: event.createdAt,
    $updatedAt: event.updatedAt,
  };
}

function reminderParameters(reminder: EventReminder): AppDatabaseParameters {
  return {
    $id: reminder.id,
    $eventId: reminder.eventId,
    $minutesBefore: reminder.minutesBefore,
    $sortOrder: reminder.sortOrder,
  };
}

function normalizeAggregate(aggregate: EventAggregate): NormalizedEventAggregate {
  const event = parseCalendarEvent(aggregate.event);
  if (!event.ok) throw new Error('Invalid event aggregate');
  const reminders = normalizeEventReminders(event.value.id, aggregate.reminders);
  if (!reminders.ok) throw new Error('Invalid event reminders');
  return { event: event.value, reminders: reminders.value };
}

const INSERT_EVENT_SQL = `INSERT INTO events (
  id, calendar_id, title, temporal_type, anchor_date, temporal_definition_id,
  start_time, duration_type, duration_minutes, end_date, location, notes, color_id,
  recurrence_rule_json, created_time_zone_id, created_at, updated_at
) VALUES (
  $id, $calendarId, $title, $temporalType, $anchorDate, $temporalDefinitionId,
  $startTime, $durationType, $durationMinutes, $endDate, $location, $notes, $colorId,
  $recurrenceRuleJson, $createdTimeZoneId, $createdAt, $updatedAt
)`;

const INSERT_REMINDER_SQL = `INSERT INTO event_reminders (
  id, event_id, minutes_before, sort_order
) VALUES (
  $id, $eventId, $minutesBefore, $sortOrder
)`;

export class SqliteEventRepository implements EventRepository {
  constructor(private readonly database: AppDatabase) {}

  async create(aggregate: EventAggregate): Promise<void> {
    const normalized = normalizeAggregate(aggregate);
    await this.database.exclusiveTransaction(async (transaction) => {
      await transaction.run(INSERT_EVENT_SQL, eventParameters(normalized.event));
      for (const reminder of normalized.reminders) {
        await transaction.run(INSERT_REMINDER_SQL, reminderParameters(reminder));
      }
    });
  }

  async getById(id: string): Promise<EventAggregate | null> {
    const row = await this.database.first<EventRow>('SELECT * FROM events WHERE id = $id', { $id: id });
    if (!row) return null;
    const reminders = await this.database.all<ReminderRow>(
      `SELECT * FROM event_reminders
       WHERE event_id = $eventId
       ORDER BY sort_order, id`,
      { $eventId: id },
    );
    return { event: mapEventRow(row), reminders: reminders.map(mapReminderRow) };
  }

  async listByAnchorRange(calendarId: string, from: string, through: string): Promise<CalendarEvent[]> {
    const rows = await this.database.all<EventRow>(
      `SELECT * FROM events
       WHERE calendar_id = $calendarId AND (
         (anchor_date >= $from AND anchor_date <= $through)
         OR (recurrence_rule_json IS NOT NULL AND anchor_date <= $through)
       )
       ORDER BY anchor_date, start_time, created_at, id`,
      { $calendarId: calendarId, $from: from, $through: through },
    );
    return rows.map(mapEventRow);
  }

  async update(aggregate: EventAggregate): Promise<void> {
    const normalized = normalizeAggregate(aggregate);
    await this.database.exclusiveTransaction(async (transaction) => {
      const result = await transaction.run(
        `UPDATE events SET
          calendar_id = $calendarId, title = $title, temporal_type = $temporalType,
          anchor_date = $anchorDate, temporal_definition_id = $temporalDefinitionId,
          start_time = $startTime, duration_type = $durationType, duration_minutes = $durationMinutes,
          end_date = $endDate, location = $location, notes = $notes, color_id = $colorId,
          recurrence_rule_json = $recurrenceRuleJson, created_time_zone_id = $createdTimeZoneId,
          updated_at = $updatedAt
         WHERE id = $id`,
        eventParameters(normalized.event),
      );
      if (result.changes !== 1) throw new Error(`Event not found: ${normalized.event.id}`);
      await transaction.run('DELETE FROM event_reminders WHERE event_id = $eventId', { $eventId: normalized.event.id });
      for (const reminder of normalized.reminders) {
        await transaction.run(INSERT_REMINDER_SQL, reminderParameters(reminder));
      }
    });
  }

  async delete(id: string): Promise<void> {
    await this.database.exclusiveTransaction(async (transaction) => {
      await transaction.run('DELETE FROM event_reminders WHERE event_id = $eventId', { $eventId: id });
      await transaction.run('DELETE FROM events WHERE id = $id', { $id: id });
    });
  }
}
