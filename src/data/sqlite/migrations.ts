import { createDefaultCalendar } from '@/domain/calendar/calendar';
import { createStandardTemporalDefinitions } from '@/domain/temporal/standard-definitions';
import type { AppDatabase } from './database';

export const DATABASE_NAME = 'zakkuri-calendar.db';
export const LATEST_SCHEMA_VERSION = 4;

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
  resolver_type TEXT NOT NULL CHECK (resolver_type IN ('timeOfDay', 'week', 'weekRemainder', 'monthDays', 'monthLastDays')),
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

const SCHEMA_VERSION_2_SQL = `
ALTER TABLE calendars ADD COLUMN color_id TEXT NOT NULL DEFAULT 'blue';
ALTER TABLE events ADD COLUMN end_date TEXT;
ALTER TABLE events ADD COLUMN location TEXT;
ALTER TABLE events ADD COLUMN notes TEXT;
ALTER TABLE events ADD COLUMN color_id TEXT;
ALTER TABLE events ADD COLUMN recurrence_rule_json TEXT;
UPDATE events SET end_date = anchor_date WHERE temporal_type = 'allDay' AND end_date IS NULL;
CREATE TABLE event_reminders (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  minutes_before INTEGER NOT NULL CHECK (minutes_before >= 0),
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  UNIQUE (event_id, minutes_before)
);
CREATE INDEX event_reminders_event_order_idx ON event_reminders(event_id, sort_order, id);
CREATE INDEX events_recurrence_anchor_idx ON events(calendar_id, anchor_date)
  WHERE recurrence_rule_json IS NOT NULL;
`;

const SCHEMA_VERSION_3_SQL = `
CREATE TABLE temporal_definitions_v3 (
  id TEXT PRIMARY KEY,
  calendar_id TEXT NOT NULL REFERENCES calendars(id),
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  granularity TEXT NOT NULL CHECK (granularity IN ('day', 'week', 'month')),
  resolver_type TEXT NOT NULL CHECK (resolver_type IN ('timeOfDay', 'week', 'weekRemainder', 'monthDays', 'monthLastDays')),
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
INSERT INTO temporal_definitions_v3 SELECT * FROM temporal_definitions;
DROP TABLE temporal_definitions;
ALTER TABLE temporal_definitions_v3 RENAME TO temporal_definitions;
CREATE INDEX temporal_definitions_enabled_idx
  ON temporal_definitions(calendar_id, is_enabled, sort_order);
ALTER TABLE events ADD COLUMN fuzzy_resolution_context_json TEXT;
UPDATE events SET end_date = anchor_date WHERE temporal_type = 'fuzzy' AND end_date IS NULL;
`;

const SCHEMA_VERSION_4_SQL = `
CREATE TABLE IF NOT EXISTS recurrence_exceptions (
  series_event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  original_occurrence_date TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('deleted', 'replaced')),
  replacement_event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
  override_fields_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (series_event_id, original_occurrence_date),
  CHECK (
    (kind = 'deleted' AND replacement_event_id IS NULL)
    OR (kind = 'replaced' AND replacement_event_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS recurrence_exceptions_replacement_event_id
  ON recurrence_exceptions(replacement_event_id)
  WHERE replacement_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS recurrence_exceptions_series_date
  ON recurrence_exceptions(series_event_id, original_occurrence_date);
`;

export async function migrateDatabase(
  database: AppDatabase,
  environment: MigrationEnvironment,
): Promise<void> {
  await database.exec('PRAGMA journal_mode = WAL;');
  await database.exec('PRAGMA foreign_keys = ON;');
  // 親テーブルのCHECK制約を再構築する間だけ無効化し、同一transaction内で
  // 同名テーブルへ戻す。通常利用へ制約OFFの接続を漏らさないようfinallyで復元する。
  await database.exec('PRAGMA foreign_keys = OFF;');

  try {
    await database.exclusiveTransaction(async (transaction) => {
    await transaction.exec(MIGRATION_TABLE_SQL);
    const current = await transaction.first<{ version: number | null }>(
      'SELECT MAX(version) AS version FROM schema_migrations',
    );
    const currentVersion = current?.version ?? 0;
    if (currentVersion >= LATEST_SCHEMA_VERSION) return;

    if (currentVersion < 1) {
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
        { $version: 1, $appliedAt: now },
      );
    }

    if (currentVersion < 2) {
      await transaction.exec(SCHEMA_VERSION_2_SQL);
      await transaction.run(
        `INSERT INTO schema_migrations (version, applied_at)
         VALUES ($version, $appliedAt)
         ON CONFLICT DO NOTHING`,
        { $version: 2, $appliedAt: environment.now() },
      );
    }

    if (currentVersion < 3) {
      await transaction.exec(SCHEMA_VERSION_3_SQL);
      const now = environment.now();
      const calendars = await transaction.all<{ id: string }>('SELECT id FROM calendars');
      for (const calendar of calendars) {
        const definition = createStandardTemporalDefinitions(calendar.id, now)
          .find((candidate) => candidate.key === 'this_week');
        if (definition === undefined) throw new Error('Missing standard this_week definition');
        await transaction.run(
          `INSERT INTO temporal_definitions (
            id, calendar_id, key, label, granularity, resolver_type, resolver_config_json,
            fade_in_ratio, fade_out_ratio, is_system, is_enabled, sort_order, created_at, updated_at
          ) VALUES (
            $id, $calendarId, $key, $label, $granularity, $resolverType, $resolverConfigJson,
            $fadeInRatio, $fadeOutRatio, $isSystem, $isEnabled, $sortOrder, $createdAt, $updatedAt
          ) ON CONFLICT DO NOTHING`,
          {
            $id: definition.id, $calendarId: definition.calendarId, $key: definition.key,
            $label: definition.label, $granularity: definition.granularity,
            $resolverType: definition.resolverConfig.kind,
            $resolverConfigJson: JSON.stringify(definition.resolverConfig),
            $fadeInRatio: definition.fadeInRatio, $fadeOutRatio: definition.fadeOutRatio,
            $isSystem: 1, $isEnabled: 1, $sortOrder: definition.sortOrder,
            $createdAt: definition.createdAt, $updatedAt: definition.updatedAt,
          },
        );
      }
      await transaction.run(
        `INSERT INTO schema_migrations (version, applied_at)
         VALUES ($version, $appliedAt)
         ON CONFLICT DO NOTHING`,
        { $version: 3, $appliedAt: now },
      );
    }

    if (currentVersion < 4) {
      await transaction.exec(SCHEMA_VERSION_4_SQL);
      await transaction.run(
        `INSERT INTO schema_migrations (version, applied_at)
         VALUES ($version, $appliedAt)
         ON CONFLICT DO NOTHING`,
        { $version: 4, $appliedAt: environment.now() },
      );
    }
    });
  } finally {
    await database.exec('PRAGMA foreign_keys = ON;');
  }
}
