import { applyTemporalPatch, reResolveTemporalEvent, temporalDefinitionToken, TemporalConflictError, type TemporalDefinitionPatch } from '@/domain/temporal/temporal-preferences';
import type { TemporalUpdateCommand, TemporalUpdatePreview } from '@/domain/calendar/repositories';
import { mapEventRow, type EventRow } from './row-mappers';
import { SqliteNotificationRepository } from './notification-repository';

import type { TemporalDefinitionRepository } from '@/domain/calendar/repositories';
import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';
import type { AppDatabase } from './database';
import { mapTemporalDefinitionRow, type TemporalDefinitionRow } from './row-mappers';

export class SqliteTemporalDefinitionRepository implements TemporalDefinitionRepository {
  constructor(private readonly database: AppDatabase) {}

  async listEditable(calendarId: string): Promise<TemporalDefinition[]> {
    const rows = await this.database.all<TemporalDefinitionRow>(
      'SELECT * FROM temporal_definitions WHERE calendar_id=$calendarId AND is_system=1 ORDER BY sort_order,key',
      { $calendarId: calendarId },
    );
    return rows.map(mapTemporalDefinitionRow);
  }

  private async plan(id: string, patch: TemporalDefinitionPatch) {
    const definition = await this.getById(id);
    if (!definition || !definition.isSystem) throw new Error('時間表現を読み込めません');
    const next = applyTemporalPatch(definition, patch);
    const revision = await new SqliteNotificationRepository(this.database).getRevision();
    const rows = await this.database.all<EventRow>(
      "SELECT * FROM events WHERE temporal_type='fuzzy' AND temporal_definition_id=$id ORDER BY id", { $id: id },
    );
    const events = rows.map(mapEventRow);
    if (events.some(event => event.calendarId !== definition.calendarId)) throw new Error('時間表現の参照が不正です');
    const rangeChanged = JSON.stringify(definition.resolverConfig) !== JSON.stringify(next.resolverConfig);
    // 全対象を先に検証してから書き込み、一部だけが新定義になる状態を防ぐ。
    const updates = rangeChanged ? events.map(event => reResolveTemporalEvent(event, next))
      .filter((event, index) => event.anchorDate !== events[index].anchorDate ||
        (event.temporalType !== 'exact' && events[index].temporalType !== 'exact' && event.endDate !== events[index].endDate)) : [];
    const preview: TemporalUpdatePreview = { token: JSON.stringify([temporalDefinitionToken(definition), revision]), count: events.length, definition, next };
    return { preview, rangeChanged, updates };
  }

  async previewUpdate(id: string, patch: TemporalDefinitionPatch): Promise<TemporalUpdatePreview> {
    let preview!: TemporalUpdatePreview;
    await this.database.exclusiveTransaction(async tx => { preview = (await new SqliteTemporalDefinitionRepository(tx).plan(id, patch)).preview; });
    return preview;
  }

  async updateDefinition(command: TemporalUpdateCommand): Promise<void> {
    await this.database.exclusiveTransaction(async tx => {
      const { preview, rangeChanged, updates } = await new SqliteTemporalDefinitionRepository(tx).plan(command.id, command.patch);
      if (preview.token !== command.token) throw new TemporalConflictError();
      await tx.run(`UPDATE temporal_definitions SET resolver_config_json=$config,fade_in_ratio=$fadeIn,fade_out_ratio=$fadeOut,updated_at=$now WHERE id=$id`, {
        $id:command.id, $config:JSON.stringify(preview.next.resolverConfig), $fadeIn:preview.next.fadeInRatio, $fadeOut:preview.next.fadeOutRatio, $now:command.now,
      });
      for (const event of updates) {
        if (event.temporalType !== 'fuzzy') throw new Error('時間表現の参照が不正です');
        await tx.run('UPDATE events SET anchor_date=$start,end_date=$end,updated_at=$now WHERE id=$id', {
          $start:event.anchorDate,$end:event.endDate,$now:command.now,$id:event.id,
        });
      }
      if (rangeChanged) await tx.run('UPDATE notification_sync_state SET desired_revision=desired_revision+1 WHERE id=1');
    });
  }

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
