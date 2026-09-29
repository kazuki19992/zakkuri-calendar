import { DEFAULT_CALENDAR_ID, type Calendar } from '@/domain/calendar/calendar';
import { parseEventColorId, type EventColorId } from '@/domain/calendar/event-color';
import type { CalendarRepository } from '@/domain/calendar/repositories';
import type { AppDatabase } from './database';
import { mapCalendarRow, type CalendarRow } from './row-mappers';

export class SqliteCalendarRepository implements CalendarRepository {
  constructor(private readonly database: AppDatabase) {}

  async getDefault(): Promise<Calendar> {
    const row = await this.database.first<CalendarRow>(
      'SELECT * FROM calendars WHERE id = $id',
      { $id: DEFAULT_CALENDAR_ID },
    );
    if (!row) throw new Error(`Calendar not found: ${DEFAULT_CALENDAR_ID}`);
    return mapCalendarRow(row);
  }

  async setColor(id: string, colorId: EventColorId, updatedAt: string): Promise<void> {
    if (!parseEventColorId(colorId).ok) throw new Error('Invalid calendar color');
    await this.database.run(
      'UPDATE calendars SET color_id = $colorId, updated_at = $updatedAt WHERE id = $id',
      { $id: id, $colorId: colorId, $updatedAt: updatedAt },
    );
  }
}
