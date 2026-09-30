import { createDatabaseDouble } from '@/test/create-database-double';
import { LATEST_SCHEMA_VERSION, migrateDatabase } from '../migrations';

const environment = {
  now: () => '2026-09-08T00:00:00.000Z',
  timeZoneId: () => 'Asia/Tokyo',
};

describe('migrateDatabase', () => {
  it('enables WAL and foreign keys before opening the migration transaction', async () => {
    const database = createDatabaseDouble();

    await migrateDatabase(database.database, environment);

    expect(database.exec).toHaveBeenNthCalledWith(1, 'PRAGMA journal_mode = WAL;');
    expect(database.exec).toHaveBeenNthCalledWith(2, 'PRAGMA foreign_keys = ON;');
    expect(database.exec.mock.invocationCallOrder[1]).toBeLessThan(
      database.exclusiveTransaction.mock.invocationCallOrder[0],
    );
  });

  it('creates the versioned schema and indexes inside one exclusive transaction', async () => {
    const database = createDatabaseDouble();

    await migrateDatabase(database.database, environment);

    expect(database.exclusiveTransaction).toHaveBeenCalledTimes(1);
    const schemaSql = database.exec.mock.calls.map(([sql]) => sql).join('\n');
    for (const table of ['schema_migrations', 'calendars', 'temporal_definitions', 'events', 'app_settings']) {
      expect(schemaSql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    expect(schemaSql).toContain('UNIQUE (calendar_id, key)');
    expect(schemaSql).toContain('fade_in_ratio + fade_out_ratio <= 1');
    expect(schemaSql).toContain('CREATE INDEX IF NOT EXISTS events_anchor_range_idx');
    expect(schemaSql).toContain('CREATE INDEX IF NOT EXISTS temporal_definitions_enabled_idx');
    expect(schemaSql).toContain("ALTER TABLE calendars ADD COLUMN color_id TEXT NOT NULL DEFAULT 'blue'");
    expect(schemaSql).toContain('ALTER TABLE events ADD COLUMN end_date TEXT');
    expect(schemaSql).toContain('CREATE TABLE event_reminders');
    expect(schemaSql).toContain('ON DELETE CASCADE');
    expect(schemaSql).toContain('CREATE INDEX event_reminders_event_order_idx');
    expect(schemaSql).toContain('CREATE INDEX events_recurrence_anchor_idx');
    expect(schemaSql).toContain('ALTER TABLE events ADD COLUMN fuzzy_resolution_context_json TEXT');
    expect(schemaSql).toContain("UPDATE events SET end_date = anchor_date WHERE temporal_type = 'fuzzy'");
  });

  it('seeds stable defaults with bound values without overwriting existing values', async () => {
    const database = createDatabaseDouble();

    await migrateDatabase(database.database, environment);

    const writes = database.run.mock.calls as [string, Record<string, unknown>][];
    expect(writes).toHaveLength(29);
    expect(writes.every(([sql]) => sql.includes('ON CONFLICT DO NOTHING'))).toBe(true);
    expect(writes[0][1]).toMatchObject({
      $id: 'personal-default',
      $timeZoneId: 'Asia/Tokyo',
      $createdAt: environment.now(),
    });
    const definitionWrites = writes.filter(([sql]) => sql.includes('temporal_definitions'));
    expect(definitionWrites).toHaveLength(23);
    expect(definitionWrites[0][1]).toMatchObject({
      $id: 'personal-default:morning',
      $resolverType: 'timeOfDay',
    });
    expect(JSON.parse(String(definitionWrites[0][1].$resolverConfigJson))).toEqual({
      kind: 'timeOfDay', startMinute: 360, endMinute: 600,
    });
    expect(writes).toContainEqual([
      expect.stringContaining('app_settings'),
      expect.objectContaining({ $key: 'default_exact_duration', $valueJson: '{"type":"instant"}' }),
    ]);
    expect(writes).toContainEqual([
      expect.stringContaining('app_settings'),
      expect.objectContaining({ $key: 'undetermined_fade_minutes', $valueJson: '120' }),
    ]);
    expect(writes.find(([, parameters]) => parameters.$version === 1)?.[1]).toMatchObject({ $version: 1 });
    expect(writes.at(-1)?.[1]).toMatchObject({ $version: LATEST_SCHEMA_VERSION });
  });

  it('migrates an existing version 1 database to version 2 without deleting events', async () => {
    const database = createDatabaseDouble();
    database.first.mockResolvedValue({ version: 1 });

    await migrateDatabase(database.database, environment);

    const schemaSql = database.exec.mock.calls.map(([sql]) => sql).join('\n');
    expect(schemaSql).toContain("ALTER TABLE calendars ADD COLUMN color_id TEXT NOT NULL DEFAULT 'blue'");
    expect(schemaSql).toContain('ALTER TABLE events ADD COLUMN end_date TEXT');
    expect(schemaSql).toContain('CREATE TABLE event_reminders');
    expect(schemaSql).not.toContain('DELETE FROM events');
    expect(database.run).toHaveBeenCalledWith(expect.stringContaining('schema_migrations'), {
      $version: 2,
      $appliedAt: environment.now(),
    });
  });

  it('backfills an end date only for existing all-day events', async () => {
    const database = createDatabaseDouble();
    database.first.mockResolvedValue({ version: 1 });

    await migrateDatabase(database.database, environment);

    expect(database.exec).toHaveBeenCalledWith(expect.stringContaining(
      "UPDATE events SET end_date = anchor_date WHERE temporal_type = 'allDay' AND end_date IS NULL",
    ));
  });

  it('version 2から既存fuzzyを補完して今週中定義を追加する', async () => {
    const database = createDatabaseDouble();
    database.first.mockResolvedValue({ version: 2 });
    database.all.mockResolvedValue([{ id: 'personal-default' }]);

    await migrateDatabase(database.database, environment);

    expect(database.exec).toHaveBeenCalledWith(expect.stringContaining('fuzzy_resolution_context_json'));
    expect(database.exec).toHaveBeenCalledWith(expect.stringContaining("temporal_type = 'fuzzy'"));
    expect(database.run).toHaveBeenCalledWith(expect.stringContaining('temporal_definitions'),
      expect.objectContaining({ $key: 'this_week', $resolverType: 'weekRemainder' }));
    expect(database.run).toHaveBeenCalledWith(expect.stringContaining('schema_migrations'), {
      $version: 3, $appliedAt: environment.now(),
    });
  });

  it('does not record a completed version after a seed fails', async () => {
    const database = createDatabaseDouble();
    database.run.mockRejectedValueOnce(new Error('seed failed'));

    await expect(migrateDatabase(database.database, environment)).rejects.toThrow('seed failed');

    expect(database.run).not.toHaveBeenCalledWith(
      expect.stringContaining('schema_migrations'),
      expect.objectContaining({ $version: 1 }),
    );
  });

  it('does not record version 2 after its schema changes fail', async () => {
    const database = createDatabaseDouble();
    database.first.mockResolvedValue({ version: 1 });
    database.exec
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('migration failed'));

    await expect(migrateDatabase(database.database, environment)).rejects.toThrow('migration failed');

    expect(database.run).not.toHaveBeenCalledWith(
      expect.stringContaining('schema_migrations'),
      expect.objectContaining({ $version: 2 }),
    );
  });
});
