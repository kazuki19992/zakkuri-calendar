import type { TemporalDefinitionRepository } from '@/domain/calendar/repositories';
import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';
import type { AppDatabase } from './database';
import { mapTemporalDefinitionRow, type TemporalDefinitionRow } from './row-mappers';

export class SqliteTemporalDefinitionRepository implements TemporalDefinitionRepository {
  constructor(private readonly database: AppDatabase) {}

  async listEnabled(calendarId: string): Promise<TemporalDefinition[]> {
    const rows = await this.database.all<TemporalDefinitionRow>(
      `SELECT * FROM temporal_definitions
       WHERE calendar_id = $calendarId AND is_enabled = 1
       ORDER BY sort_order, key`,
      { $calendarId: calendarId },
    );
    return rows.map(mapTemporalDefinitionRow);
  }

  async getById(id: string): Promise<TemporalDefinition | null> {
    const row = await this.database.first<TemporalDefinitionRow>(
      'SELECT * FROM temporal_definitions WHERE id = $id',
      { $id: id },
    );
    return row ? mapTemporalDefinitionRow(row) : null;
  }

  async disable(id: string, updatedAt: string): Promise<void> {
    const result = await this.database.run(
      `UPDATE temporal_definitions SET is_enabled = 0, updated_at = $updatedAt
       WHERE id = $id`,
      { $id: id, $updatedAt: updatedAt },
    );
    if (result.changes !== 1) throw new Error(`Temporal definition not found: ${id}`);
  }
}
