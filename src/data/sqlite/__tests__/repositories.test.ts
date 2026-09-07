import type { CalendarEvent } from '@/domain/calendar/event';
import { createDatabaseDouble } from '@/test/create-database-double';
import { SqliteCalendarRepository } from '../calendar-repository';
import { SqliteEventRepository } from '../event-repository';
import { createRepositoryContainer } from '../repository-container';
import { SqliteSettingsRepository } from '../settings-repository';
import { SqliteTemporalDefinitionRepository } from '../temporal-definition-repository';
import type { CalendarRow, EventRow, TemporalDefinitionRow } from '../row-mappers';

const now = '2026-09-08T00:00:00.000Z';
const calendarRow: CalendarRow = { id: 'personal-default', name: 'マイカレンダー', time_zone_id: 'Asia/Tokyo', created_at: now, updated_at: now };
const definitionRow: TemporalDefinitionRow = {
  id: 'personal-default:morning', calendar_id: 'personal-default', key: 'morning', label: '朝', granularity: 'day', resolver_type: 'timeOfDay',
  resolver_config_json: '{"kind":"timeOfDay","startMinute":360,"endMinute":600}', fade_in_ratio: 0.25, fade_out_ratio: 0.25,
  is_system: 1, is_enabled: 1, sort_order: 10, created_at: now, updated_at: now,
};
const eventRow: EventRow = {
  id: 'event-1', calendar_id: 'personal-default', title: '歯医者', temporal_type: 'exact', anchor_date: '2026-09-08',
  temporal_definition_id: null, start_time: '14:30', duration_type: 'fixed', duration_minutes: 30,
  created_time_zone_id: 'Asia/Tokyo', created_at: now, updated_at: now,
};
const exactEvent: CalendarEvent = {
  id: 'event-1', calendarId: 'personal-default', title: '歯医者', temporalType: 'exact', anchorDate: '2026-09-08',
  startTime: '14:30', duration: { type: 'fixed', minutes: 30 }, createdTimeZoneId: 'Asia/Tokyo', createdAt: now, updatedAt: now,
};
const allDayEvent: CalendarEvent = {
  id: 'event-2', calendarId: 'personal-default', title: '休暇', temporalType: 'allDay', anchorDate: '2026-09-09',
  createdTimeZoneId: 'Asia/Tokyo', createdAt: now, updatedAt: now,
};
const fuzzyEvent: CalendarEvent = {
  id: 'event-3', calendarId: 'personal-default', title: '散歩', temporalType: 'fuzzy', anchorDate: '2026-09-10',
  temporalDefinitionId: definitionRow.id, createdTimeZoneId: 'Asia/Tokyo', createdAt: now, updatedAt: now,
};

describe('SQLite repositories', () => {
  it('looks up the stable default calendar with a bound id', async () => {
    const db = createDatabaseDouble();
    db.first.mockResolvedValue(calendarRow);
    await expect(new SqliteCalendarRepository(db.database).getDefault()).resolves.toMatchObject({ id: 'personal-default' });
    expect(db.first).toHaveBeenCalledWith(expect.stringContaining('WHERE id = $id'), { $id: 'personal-default' });
  });

  it('lists enabled definitions deterministically and keeps disabled definitions addressable', async () => {
    const db = createDatabaseDouble();
    db.all.mockResolvedValue([definitionRow]);
    db.first.mockResolvedValue({ ...definitionRow, is_enabled: 0 });
    const repository = new SqliteTemporalDefinitionRepository(db.database);
    await expect(repository.listEnabled('personal-default')).resolves.toHaveLength(1);
    expect(db.all).toHaveBeenCalledWith(expect.stringContaining('is_enabled = 1'), { $calendarId: 'personal-default' });
    expect(db.all.mock.calls[0][0]).toContain('ORDER BY sort_order, key');
    await expect(repository.getById(definitionRow.id)).resolves.toMatchObject({ isEnabled: false });
  });

  it('soft-disables a definition and rejects a missing id', async () => {
    const db = createDatabaseDouble();
    const repository = new SqliteTemporalDefinitionRepository(db.database);
    await repository.disable(definitionRow.id, now);
    expect(db.run).toHaveBeenCalledWith(expect.stringContaining('UPDATE temporal_definitions'), { $id: definitionRow.id, $updatedAt: now });
    expect(db.run.mock.calls[0][0]).not.toContain('DELETE');
    db.run.mockResolvedValueOnce({ changes: 0, lastInsertRowId: 0 });
    await expect(repository.disable('missing', now)).rejects.toThrow('Temporal definition not found: missing');
  });

  it('queries an inclusive anchor range with deterministic ordering', async () => {
    const db = createDatabaseDouble();
    db.all.mockResolvedValue([eventRow]);
    const events = new SqliteEventRepository(db.database);
    await expect(events.listByAnchorRange('personal-default', '2026-09-01', '2026-09-30')).resolves.toHaveLength(1);
    expect(db.all).toHaveBeenCalledWith(expect.stringContaining('anchor_date >= $from'), {
      $calendarId: 'personal-default', $from: '2026-09-01', $through: '2026-09-30',
    });
    expect(db.all.mock.calls[0][0]).toContain('anchor_date <= $through');
    expect(db.all.mock.calls[0][0]).toContain('ORDER BY anchor_date, start_time, created_at, id');
  });

  it.each([
    [exactEvent, { $startTime: '14:30', $durationType: 'fixed', $durationMinutes: 30, $temporalDefinitionId: null }],
    [allDayEvent, { $startTime: null, $durationType: null, $durationMinutes: null, $temporalDefinitionId: null }],
    [fuzzyEvent, { $startTime: null, $durationType: null, $durationMinutes: null, $temporalDefinitionId: definitionRow.id }],
  ])('binds consistent nullable columns when creating event variants', async (event, expected) => {
    const db = createDatabaseDouble();
    await new SqliteEventRepository(db.database).create(event);
    expect(db.run).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO events'), expect.objectContaining(expected));
  });

  it('updates and deletes using bound ids', async () => {
    const db = createDatabaseDouble();
    const events = new SqliteEventRepository(db.database);
    await events.update(exactEvent);
    expect(db.run).toHaveBeenCalledWith(expect.stringContaining('UPDATE events'), expect.objectContaining({ $id: 'event-1' }));
    await events.delete('event-1');
    expect(db.run).toHaveBeenLastCalledWith(expect.stringContaining('DELETE FROM events'), { $id: 'event-1' });
  });

  it.each([[null, { type: 'instant' }], [{ value_json: 'private broken value' }, { type: 'instant' }]])(
    'returns a safe exact-duration fallback for missing or malformed data', async (row, expected) => {
      const db = createDatabaseDouble();
      db.first.mockResolvedValue(row);
      await expect(new SqliteSettingsRepository(db.database).getDefaultExactDuration()).resolves.toEqual(expected);
    },
  );

  it('reads fade minutes safely and upserts a validated duration', async () => {
    const db = createDatabaseDouble();
    db.first.mockResolvedValue({ value_json: '120' });
    const settings = new SqliteSettingsRepository(db.database);
    await expect(settings.getUndeterminedFadeMinutes()).resolves.toBe(120);
    await settings.setDefaultExactDuration({ type: 'fixed', minutes: 15 }, now);
    expect(db.run).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT(key) DO UPDATE'), {
      $key: 'default_exact_duration', $valueJson: '{"type":"fixed","minutes":15}', $updatedAt: now,
    });
  });

  it('constructs one complete repository container', () => {
    const container = createRepositoryContainer(createDatabaseDouble().database);
    expect(Object.keys(container).sort()).toEqual(['calendars', 'events', 'settings', 'temporalDefinitions']);
  });
});
