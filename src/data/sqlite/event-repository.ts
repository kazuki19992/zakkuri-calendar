import type { EventRepository } from '@/domain/calendar/repositories';
import type { CalendarEvent } from '@/domain/calendar/event';
import type { AppDatabase, AppDatabaseParameters } from './database';
import { mapEventRow, type EventRow } from './row-mappers';

function eventParameters(event: CalendarEvent): AppDatabaseParameters {
  let temporalDefinitionId: string | null = null;
  let startTime: string | null = null;
  let durationType: string | null = null;
  let durationMinutes: number | null = null;
  if (event.temporalType === 'exact') {
    startTime = event.startTime;
    durationType = event.duration.type;
    durationMinutes = event.duration.type === 'fixed' ? event.duration.minutes : null;
  } else if (event.temporalType === 'fuzzy') {
    temporalDefinitionId = event.temporalDefinitionId;
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
    $createdTimeZoneId: event.createdTimeZoneId,
    $createdAt: event.createdAt,
    $updatedAt: event.updatedAt,
  };
}

export class SqliteEventRepository implements EventRepository {
  constructor(private readonly database: AppDatabase) {}

  async create(event: CalendarEvent): Promise<void> {
    await this.database.run(
      `INSERT INTO events (
        id, calendar_id, title, temporal_type, anchor_date, temporal_definition_id,
        start_time, duration_type, duration_minutes, created_time_zone_id, created_at, updated_at
      ) VALUES (
        $id, $calendarId, $title, $temporalType, $anchorDate, $temporalDefinitionId,
        $startTime, $durationType, $durationMinutes, $createdTimeZoneId, $createdAt, $updatedAt
      )`,
      eventParameters(event),
    );
  }

  async getById(id: string): Promise<CalendarEvent | null> {
    const row = await this.database.first<EventRow>('SELECT * FROM events WHERE id = $id', { $id: id });
    return row ? mapEventRow(row) : null;
  }

  async listByAnchorRange(calendarId: string, from: string, through: string): Promise<CalendarEvent[]> {
    const rows = await this.database.all<EventRow>(
      `SELECT * FROM events
       WHERE calendar_id = $calendarId AND anchor_date >= $from AND anchor_date <= $through
       ORDER BY anchor_date, start_time, created_at, id`,
      { $calendarId: calendarId, $from: from, $through: through },
    );
    return rows.map(mapEventRow);
  }

  async update(event: CalendarEvent): Promise<void> {
    const result = await this.database.run(
      `UPDATE events SET
        calendar_id = $calendarId, title = $title, temporal_type = $temporalType,
        anchor_date = $anchorDate, temporal_definition_id = $temporalDefinitionId,
        start_time = $startTime, duration_type = $durationType, duration_minutes = $durationMinutes,
        created_time_zone_id = $createdTimeZoneId, updated_at = $updatedAt
       WHERE id = $id`,
      eventParameters(event),
    );
    if (result.changes !== 1) throw new Error(`Event not found: ${event.id}`);
  }

  async delete(id: string): Promise<void> {
    await this.database.run('DELETE FROM events WHERE id = $id', { $id: id });
  }
}
