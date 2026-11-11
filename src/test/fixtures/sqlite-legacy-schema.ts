import type { AppDatabase } from '@/data/sqlite/database';

const historicalSchemas = [
  // schema version 1: ca8e976 のDDLを固定。現行migrationから動的生成しない。
  `
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
`,
  // schema version 2: 8a5fc5c のDDLを固定。現行migrationから動的生成しない。
  `
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
`,
  // schema version 3: 07d8c10 のDDLを固定。現行migrationから動的生成しない。
  `
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
`,
  // schema version 4: 031cd9e のDDLを固定。現行migrationから動的生成しない。
  `
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
`,
  // schema version 5: c593050 のDDLを固定。現行migrationから動的生成しない。
  `
ALTER TABLE events ADD COLUMN notes_document_json TEXT;
`,
];

/** 合成データ用の旧schema。過去の制約を含む構造を固定し、現行migrationとの共倒れを防ぐ。 */
export async function createLegacySchema(database: AppDatabase, version: number) {
  await database.exec(`CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);`);
  for (let index = 0; index < version; index += 1) {
    await database.exec(historicalSchemas[index]);
    await database.run('INSERT INTO schema_migrations VALUES ($version, $now)', {
      $version: index + 1, $now: '2026-09-08T00:00:00.000Z',
    });
  }
}
