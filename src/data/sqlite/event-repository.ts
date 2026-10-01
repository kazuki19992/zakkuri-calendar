import type {
  ApplyRecurrenceMutationCommand,
  DeleteOccurrenceExceptionCommand,
  EventRepository,
  OccurrenceEditData,
  SaveOccurrenceExceptionCommand,
} from '@/domain/calendar/repositories';
import { parseCalendarEvent, type CalendarEvent } from '@/domain/calendar/event';
import {
  normalizeEventReminders,
  type EventAggregate,
  type EventReminder,
} from '@/domain/calendar/event-reminder';
import type { AppDatabase, AppDatabaseParameters } from './database';
import {
  mapEventRow,
  mapRecurrenceExceptionRow,
  mapReminderRow,
  type EventRow,
  type RecurrenceExceptionRow,
  type ReminderRow,
} from './row-mappers';
import type { OccurrenceIdentity, RecurrenceException } from '@/domain/calendar/recurrence-exception';
import { expandEventOccurrences } from '@/domain/calendar/event-occurrence';

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
  let fuzzyResolutionContextJson: string | null = null;
  if (event.temporalType === 'exact') {
    startTime = event.startTime;
    durationType = event.duration.type;
    durationMinutes = event.duration.type === 'fixed' ? event.duration.minutes : null;
  } else if (event.temporalType === 'fuzzy') {
    temporalDefinitionId = event.temporalDefinitionId;
    endDate = event.endDate;
    fuzzyResolutionContextJson = event.resolutionContext === null
      ? null
      : JSON.stringify(event.resolutionContext);
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
    $fuzzyResolutionContextJson: fuzzyResolutionContextJson,
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

async function assertFuzzyDefinitionConsistency(
  database: AppDatabase,
  event: CalendarEvent,
): Promise<void> {
  if (event.temporalType !== 'fuzzy') return;
  const definition = await database.first<{ granularity: string }>(
    'SELECT granularity FROM temporal_definitions WHERE id = $id',
    { $id: event.temporalDefinitionId },
  );
  if (definition === null) throw new Error('Invalid fuzzy definition consistency');
  const isRelative = definition.granularity === 'week' || definition.granularity === 'month';
  const isDay = definition.granularity === 'day';
  if ((!isRelative && !isDay) ||
      (isRelative && (event.resolutionContext === null || event.recurrenceRule !== null)) ||
      (isDay && event.resolutionContext !== null)) {
    throw new Error('Invalid fuzzy definition consistency');
  }
}

const INSERT_EVENT_SQL = `INSERT INTO events (
  id, calendar_id, title, temporal_type, anchor_date, temporal_definition_id,
  start_time, duration_type, duration_minutes, end_date, location, notes, color_id,
  recurrence_rule_json, fuzzy_resolution_context_json, created_time_zone_id, created_at, updated_at
) VALUES (
  $id, $calendarId, $title, $temporalType, $anchorDate, $temporalDefinitionId,
  $startTime, $durationType, $durationMinutes, $endDate, $location, $notes, $colorId,
  $recurrenceRuleJson, $fuzzyResolutionContextJson, $createdTimeZoneId, $createdAt, $updatedAt
)`;

const INSERT_REMINDER_SQL = `INSERT INTO event_reminders (
  id, event_id, minutes_before, sort_order
) VALUES (
  $id, $eventId, $minutesBefore, $sortOrder
)`;

const UPSERT_EXCEPTION_SQL = `INSERT INTO recurrence_exceptions (
  series_event_id, original_occurrence_date, kind, replacement_event_id,
  override_fields_json, created_at, updated_at
) VALUES (
  $seriesEventId, $originalOccurrenceDate, $kind, $replacementEventId,
  $overrideFieldsJson, $createdAt, $updatedAt
) ON CONFLICT(series_event_id, original_occurrence_date) DO UPDATE SET
  kind = excluded.kind,
  replacement_event_id = excluded.replacement_event_id,
  override_fields_json = excluded.override_fields_json,
  updated_at = excluded.updated_at`;

function exceptionParameters(exception: RecurrenceException): AppDatabaseParameters {
  return {
    $seriesEventId: exception.seriesEventId,
    $originalOccurrenceDate: exception.originalOccurrenceDate,
    $kind: exception.kind,
    $replacementEventId: exception.replacementEventId,
    $overrideFieldsJson: JSON.stringify(exception.overrideFields),
    $createdAt: exception.createdAt,
    $updatedAt: exception.updatedAt,
  };
}

async function loadAggregate(database: AppDatabase, id: string): Promise<EventAggregate | null> {
  const row = await database.first<EventRow>('SELECT * FROM events WHERE id = $id', { $id: id });
  if (row === null) return null;
  const reminderRows = await database.all<ReminderRow>(
    `SELECT * FROM event_reminders WHERE event_id = $eventId ORDER BY sort_order, id`,
    { $eventId: id },
  );
  return { event: mapEventRow(row), reminders: reminderRows.map(mapReminderRow) };
}

async function replaceAggregate(database: AppDatabase, aggregate: EventAggregate): Promise<void> {
  const normalized = normalizeAggregate(aggregate);
  await assertFuzzyDefinitionConsistency(database, normalized.event);
  const updated = await database.run(
    `UPDATE events SET
      calendar_id = $calendarId, title = $title, temporal_type = $temporalType,
      anchor_date = $anchorDate, temporal_definition_id = $temporalDefinitionId,
      start_time = $startTime, duration_type = $durationType, duration_minutes = $durationMinutes,
      end_date = $endDate, location = $location, notes = $notes, color_id = $colorId,
      recurrence_rule_json = $recurrenceRuleJson,
      fuzzy_resolution_context_json = $fuzzyResolutionContextJson,
      created_time_zone_id = $createdTimeZoneId, updated_at = $updatedAt
     WHERE id = $id`,
    eventParameters(normalized.event),
  );
  if (updated.changes === 0) {
    await database.run(INSERT_EVENT_SQL, eventParameters(normalized.event));
  }
  await database.run('DELETE FROM event_reminders WHERE event_id = $eventId', {
    $eventId: normalized.event.id,
  });
  for (const reminder of normalized.reminders) {
    await database.run(INSERT_REMINDER_SQL, reminderParameters(reminder));
  }
}

async function assertSeriesRevision(
  database: AppDatabase,
  id: string,
  expectedUpdatedAt: string,
): Promise<void> {
  const result = await database.run(
    `UPDATE events SET updated_at = updated_at
     WHERE id = $id AND updated_at = $expectedUpdatedAt`,
    { $id: id, $expectedUpdatedAt: expectedUpdatedAt },
  );
  if (result.changes !== 1) throw new Error('Recurring event changed while editing');
}

async function loadValidOccurrence(
  database: AppDatabase,
  identity: OccurrenceIdentity,
): Promise<EventAggregate | null> {
  const series = await loadAggregate(database, identity.seriesEventId);
  if (series === null || series.event.recurrenceRule === null) return null;
  const expanded = expandEventOccurrences({
    events: [series.event],
    from: identity.originalOccurrenceDate,
    through: identity.originalOccurrenceDate,
  });
  if (!expanded.ok || !expanded.value.some((occurrence) =>
    occurrence.occurrenceIdentity?.originalOccurrenceDate === identity.originalOccurrenceDate)) {
    return null;
  }
  return series;
}

export class SqliteEventRepository implements EventRepository {
  constructor(private readonly database: AppDatabase) {}

  async create(aggregate: EventAggregate): Promise<void> {
    const normalized = normalizeAggregate(aggregate);
    await this.database.exclusiveTransaction(async (transaction) => {
      await assertFuzzyDefinitionConsistency(transaction, normalized.event);
      await transaction.run(INSERT_EVENT_SQL, eventParameters(normalized.event));
      for (const reminder of normalized.reminders) {
        await transaction.run(INSERT_REMINDER_SQL, reminderParameters(reminder));
      }
    });
  }

  async getById(id: string): Promise<EventAggregate | null> {
    return loadAggregate(this.database, id);
  }

  async listByAnchorRange(calendarId: string, from: string, through: string): Promise<CalendarEvent[]> {
    const rows = await this.database.all<EventRow>(
      `SELECT * FROM events
       WHERE calendar_id = $calendarId AND (
         (anchor_date <= $through AND COALESCE(end_date, anchor_date) >= $from)
         OR (recurrence_rule_json IS NOT NULL AND anchor_date <= $through)
       )
       ORDER BY anchor_date, start_time, created_at, id`,
      { $calendarId: calendarId, $from: from, $through: through },
    );
    return rows.map(mapEventRow);
  }

  async listSchedule(calendarId: string, from: string, through: string) {
    const eventRows = await this.database.all<EventRow>(
      `SELECT events.* FROM events
       WHERE events.calendar_id = $calendarId
         AND NOT EXISTS (
           SELECT 1 FROM recurrence_exceptions
           WHERE replacement_event_id = events.id
         )
         AND (
           (events.anchor_date <= $through AND COALESCE(events.end_date, events.anchor_date) >= $from)
           OR (events.recurrence_rule_json IS NOT NULL AND events.anchor_date <= $through)
           OR EXISTS (
             SELECT 1 FROM recurrence_exceptions AS moved_exception
             JOIN events AS replacement
               ON replacement.id = moved_exception.replacement_event_id
             WHERE moved_exception.series_event_id = events.id
               AND replacement.anchor_date <= $through
               AND COALESCE(replacement.end_date, replacement.anchor_date) >= $from
           )
         )
       ORDER BY anchor_date, start_time, created_at, id`,
      { $calendarId: calendarId, $from: from, $through: through },
    );
    const exceptionRows = await this.database.all<RecurrenceExceptionRow>(
      `SELECT recurrence_exceptions.* FROM recurrence_exceptions
       JOIN events AS series ON series.id = recurrence_exceptions.series_event_id
       WHERE series.calendar_id = $calendarId
       ORDER BY series_event_id, original_occurrence_date`,
      { $calendarId: calendarId },
    );
    const replacementRows = await this.database.all<EventRow>(
      `SELECT replacement.* FROM events AS replacement
       JOIN recurrence_exceptions
         ON recurrence_exceptions.replacement_event_id = replacement.id
       JOIN events AS series ON series.id = recurrence_exceptions.series_event_id
       WHERE series.calendar_id = $calendarId
       ORDER BY replacement.anchor_date, replacement.created_at, replacement.id`,
      { $calendarId: calendarId },
    );
    return {
      events: eventRows.map(mapEventRow),
      exceptions: exceptionRows.map(mapRecurrenceExceptionRow),
      replacementEvents: replacementRows.map(mapEventRow),
    };
  }

  async getOccurrenceEditData(identity: OccurrenceIdentity): Promise<OccurrenceEditData | null> {
    const series = await loadValidOccurrence(this.database, identity);
    if (series === null) return null;
    const rows = await this.database.all<RecurrenceExceptionRow>(
      `SELECT * FROM recurrence_exceptions
       WHERE series_event_id = $seriesEventId
       ORDER BY original_occurrence_date`,
      { $seriesEventId: identity.seriesEventId },
    );
    const exceptions = rows.map(mapRecurrenceExceptionRow);
    const exception = exceptions.find((item) =>
      item.originalOccurrenceDate === identity.originalOccurrenceDate) ?? null;
    const replacement = exception?.replacementEventId === null || exception === null
      ? null
      : await loadAggregate(this.database, exception.replacementEventId);
    return { series, exception, replacement, exceptions };
  }

  async saveOccurrenceException(command: SaveOccurrenceExceptionCommand): Promise<void> {
    await this.database.exclusiveTransaction(async (transaction) => {
      await assertSeriesRevision(
        transaction,
        command.identity.seriesEventId,
        command.expectedSeriesUpdatedAt,
      );
      const series = await loadValidOccurrence(transaction, command.identity);
      if (series === null) throw new Error('Occurrence no longer exists');
      const previous = await transaction.first<RecurrenceExceptionRow>(
        `SELECT * FROM recurrence_exceptions
         WHERE series_event_id = $seriesEventId
           AND original_occurrence_date = $originalOccurrenceDate`,
        {
          $seriesEventId: command.identity.seriesEventId,
          $originalOccurrenceDate: command.identity.originalOccurrenceDate,
        },
      );
      if (command.overrideFields.length === 0) {
        await transaction.run(
          `DELETE FROM recurrence_exceptions
           WHERE series_event_id = $seriesEventId
             AND original_occurrence_date = $originalOccurrenceDate`,
          {
            $seriesEventId: command.identity.seriesEventId,
            $originalOccurrenceDate: command.identity.originalOccurrenceDate,
          },
        );
        if (previous?.replacement_event_id !== null
            && previous?.replacement_event_id !== undefined) {
          await transaction.run('DELETE FROM events WHERE id = $id', {
            $id: previous.replacement_event_id,
          });
        }
        await transaction.run('UPDATE events SET updated_at = $now WHERE id = $id', {
          $id: command.identity.seriesEventId,
          $now: command.now,
        });
        return;
      }
      await replaceAggregate(transaction, command.replacement);
      await transaction.run(UPSERT_EXCEPTION_SQL, exceptionParameters({
        ...command.identity,
        kind: 'replaced',
        replacementEventId: command.replacement.event.id,
        overrideFields: command.overrideFields,
        createdAt: previous?.created_at ?? command.now,
        updatedAt: command.now,
      }));
      if (previous?.replacement_event_id !== null
          && previous?.replacement_event_id !== undefined
          && previous.replacement_event_id !== command.replacement.event.id) {
        await transaction.run('DELETE FROM events WHERE id = $id', {
          $id: previous.replacement_event_id,
        });
      }
      await transaction.run('UPDATE events SET updated_at = $now WHERE id = $id', {
        $id: command.identity.seriesEventId,
        $now: command.now,
      });
    });
  }

  async deleteOccurrenceException(command: DeleteOccurrenceExceptionCommand): Promise<void> {
    await this.database.exclusiveTransaction(async (transaction) => {
      await assertSeriesRevision(
        transaction,
        command.identity.seriesEventId,
        command.expectedSeriesUpdatedAt,
      );
      const series = await loadValidOccurrence(transaction, command.identity);
      if (series === null) throw new Error('Occurrence no longer exists');
      const previous = await transaction.first<RecurrenceExceptionRow>(
        `SELECT * FROM recurrence_exceptions
         WHERE series_event_id = $seriesEventId
           AND original_occurrence_date = $originalOccurrenceDate`,
        {
          $seriesEventId: command.identity.seriesEventId,
          $originalOccurrenceDate: command.identity.originalOccurrenceDate,
        },
      );
      await transaction.run(UPSERT_EXCEPTION_SQL, exceptionParameters({
        ...command.identity,
        kind: 'deleted',
        replacementEventId: null,
        overrideFields: [],
        createdAt: previous?.created_at ?? command.now,
        updatedAt: command.now,
      }));
      if (previous?.replacement_event_id !== null && previous?.replacement_event_id !== undefined) {
        await transaction.run('DELETE FROM events WHERE id = $id', {
          $id: previous.replacement_event_id,
        });
      }
      await transaction.run('UPDATE events SET updated_at = $now WHERE id = $id', {
        $id: command.identity.seriesEventId,
        $now: command.now,
      });
    });
  }

  async applyRecurrenceMutation(command: ApplyRecurrenceMutationCommand): Promise<void> {
    await this.database.exclusiveTransaction(async (transaction) => {
      await assertSeriesRevision(transaction, command.seriesId, command.expectedSeriesUpdatedAt);
      if (command.plan.removePreviousSeries) {
        await transaction.run('DELETE FROM events WHERE id = $id', { $id: command.seriesId });
      } else if (command.plan.previousSeries !== null) {
        await replaceAggregate(transaction, command.plan.previousSeries);
      }
      if (command.plan.nextSeries !== null) {
        await replaceAggregate(transaction, command.plan.nextSeries);
      }
      for (const identity of command.plan.deleteExceptionIdentities) {
        await transaction.run(
          `DELETE FROM recurrence_exceptions
           WHERE series_event_id = $seriesEventId
             AND original_occurrence_date = $originalOccurrenceDate`,
          {
            $seriesEventId: identity.seriesEventId,
            $originalOccurrenceDate: identity.originalOccurrenceDate,
          },
        );
      }
      for (const exception of command.plan.upsertExceptions) {
        await transaction.run(UPSERT_EXCEPTION_SQL, exceptionParameters(exception));
      }
      for (const id of command.plan.deleteReplacementEventIds) {
        await transaction.run('DELETE FROM events WHERE id = $id', { $id: id });
      }
    });
  }

  async update(aggregate: EventAggregate): Promise<void> {
    const normalized = normalizeAggregate(aggregate);
    await this.database.exclusiveTransaction(async (transaction) => {
      await assertFuzzyDefinitionConsistency(transaction, normalized.event);
      const result = await transaction.run(
        `UPDATE events SET
          calendar_id = $calendarId, title = $title, temporal_type = $temporalType,
          anchor_date = $anchorDate, temporal_definition_id = $temporalDefinitionId,
          start_time = $startTime, duration_type = $durationType, duration_minutes = $durationMinutes,
          end_date = $endDate, location = $location, notes = $notes, color_id = $colorId,
          recurrence_rule_json = $recurrenceRuleJson,
          fuzzy_resolution_context_json = $fuzzyResolutionContextJson,
          created_time_zone_id = $createdTimeZoneId,
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
      const replacements = await transaction.all<{ replacement_event_id: string }>(
        `SELECT replacement_event_id FROM recurrence_exceptions
         WHERE series_event_id = $id AND replacement_event_id IS NOT NULL`,
        { $id: id },
      );
      await transaction.run('DELETE FROM event_reminders WHERE event_id = $eventId', { $eventId: id });
      await transaction.run('DELETE FROM events WHERE id = $id', { $id: id });
      for (const replacement of replacements) {
        await transaction.run('DELETE FROM events WHERE id = $id', {
          $id: replacement.replacement_event_id,
        });
      }
    });
  }
}
