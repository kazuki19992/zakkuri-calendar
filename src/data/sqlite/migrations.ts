import { createDefaultCalendar } from '@/domain/calendar/calendar';
import { createStandardTemporalDefinitions } from '@/domain/temporal/standard-definitions';
import type { AppDatabase } from './database';

export const DATABASE_NAME = 'zakkuri-calendar.db';
export const LATEST_SCHEMA_VERSION = 1;

export type MigrationEnvironment = Readonly<{
  now: () => string;
  timeZoneId: () => string;
}>;

const MIGRATION_TABLE_SQL = `CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);`;

const SCHEMA_VERSION_1_SQL = `
CREATE TABLE IF NOT EXISTS calendars (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  time_zone_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS temporal_definitions (
  id TEXT PRIMARY KEY,
  calendar_id TEXT NOT NULL REFERENCES calendars(id),
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  granularity TEXT NOT NULL CHECK (granularity IN ('day', 'week', 'month')),
  resolver_type TEXT NOT NULL CHECK (resolver_type IN ('timeOfDay', 'week', 'monthDays', 'monthLastDays')),
  resolver_config_json TEXT NOT NULL,
  fade_in_ratio REAL NOT NULL CHECK (fade_in_ratio >= 0 AND fade_in_ratio <= 1),
  fade_out_ratio REAL NOT NULL CHECK (fade_out_ratio >= 0 AND fade_out_ratio <= 1),
  is_system INTEGER NOT NULL CHECK (is_system IN (0, 1)),
  is_enabled INTEGER NOT NULL CHECK (is_enabled IN (0, 1)),
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (fade_in_ratio + fade_out_ratio <= 1),
  UNIQUE (calendar_id, key)
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  calendar_id TEXT NOT NULL REFERENCES calendars(id),
  title TEXT NOT NULL,
  temporal_type TEXT NOT NULL CHECK (temporal_type IN ('exact', 'allDay', 'fuzzy')),
  anchor_date TEXT NOT NULL,
  temporal_definition_id TEXT REFERENCES temporal_definitions(id),
  start_time TEXT,
  duration_type TEXT CHECK (duration_type IN ('instant', 'fixed', 'undetermined')),
  duration_minutes INTEGER,
  created_time_zone_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS events_anchor_range_idx
  ON events(calendar_id, anchor_date);
CREATE INDEX IF NOT EXISTS temporal_definitions_enabled_idx
  ON temporal_definitions(calendar_id, is_enabled, sort_order);
`;

export async function migrateDatabase(
  database: AppDatabase,
  environment: MigrationEnvironment,
): Promise<void> {
  await database.exec('PRAGMA journal_mode = WAL;');
  await database.exec('PRAGMA foreign_keys = ON;');

  await database.exclusiveTransaction(async (transaction) => {
    await transaction.exec(MIGRATION_TABLE_SQL);
    const current = await transaction.first<{ version: number | null }>(
      'SELECT MAX(version) AS version FROM schema_migrations',
    );
    if ((current?.version ?? 0) >= LATEST_SCHEMA_VERSION) return;

    const now = environment.now();
    const calendar = createDefaultCalendar(environment.timeZoneId(), now);
    const definitions = createStandardTemporalDefinitions(calendar.id, now);

    await transaction.exec(SCHEMA_VERSION_1_SQL);
    await transaction.run(
      `INSERT INTO calendars (id, name, time_zone_id, created_at, updated_at)
       VALUES ($id, $name, $timeZoneId, $createdAt, $updatedAt)
       ON CONFLICT DO NOTHING`,
      {
        $id: calendar.id,
        $name: calendar.name,
        $timeZoneId: calendar.timeZoneId,
        $createdAt: calendar.createdAt,
        $updatedAt: calendar.updatedAt,
      },
    );

    for (const definition of definitions) {
      await transaction.run(
        `INSERT INTO temporal_definitions (
          id, calendar_id, key, label, granularity, resolver_type, resolver_config_json,
          fade_in_ratio, fade_out_ratio, is_system, is_enabled, sort_order, created_at, updated_at
        ) VALUES (
          $id, $calendarId, $key, $label, $granularity, $resolverType, $resolverConfigJson,
          $fadeInRatio, $fadeOutRatio, $isSystem, $isEnabled, $sortOrder, $createdAt, $updatedAt
        ) ON CONFLICT DO NOTHING`,
        {
          $id: definition.id,
          $calendarId: definition.calendarId,
          $key: definition.key,
          $label: definition.label,
          $granularity: definition.granularity,
          $resolverType: definition.resolverConfig.kind,
          $resolverConfigJson: JSON.stringify(definition.resolverConfig),
          $fadeInRatio: definition.fadeInRatio,
          $fadeOutRatio: definition.fadeOutRatio,
          $isSystem: definition.isSystem ? 1 : 0,
          $isEnabled: definition.isEnabled ? 1 : 0,
          $sortOrder: definition.sortOrder,
          $createdAt: definition.createdAt,
          $updatedAt: definition.updatedAt,
        },
      );
    }

    for (const [key, valueJson] of [
      ['default_exact_duration', JSON.stringify({ type: 'instant' })],
      ['undetermined_fade_minutes', JSON.stringify(120)],
    ] as const) {
      await transaction.run(
        `INSERT INTO app_settings (key, value_json, updated_at)
         VALUES ($key, $valueJson, $updatedAt)
         ON CONFLICT DO NOTHING`,
        { $key: key, $valueJson: valueJson, $updatedAt: now },
      );
    }

    await transaction.run(
      `INSERT INTO schema_migrations (version, applied_at)
       VALUES ($version, $appliedAt)
       ON CONFLICT DO NOTHING`,
      { $version: LATEST_SCHEMA_VERSION, $appliedAt: now },
    );
  });
}
