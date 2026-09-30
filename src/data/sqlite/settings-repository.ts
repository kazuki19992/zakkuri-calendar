import { parseExactDuration, type EventEditorTab, type ExactDuration } from '@/domain/calendar/event';
import type { SettingsRepository } from '@/domain/calendar/repositories';
import type { AppDatabase } from './database';
import type { ThisWeekDeadlineWeekday } from '@/domain/temporal/relative-date-resolution';

type SettingRow = Readonly<{ value_json: string }>;
const DEFAULT_DURATION: ExactDuration = { type: 'instant' };
const DEFAULT_FADE_MINUTES = 120;
const DEFAULT_EVENT_EDITOR_TAB: EventEditorTab = 'fuzzy';
const DEFAULT_THIS_WEEK_DEADLINE: ThisWeekDeadlineWeekday = 5;

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function getCalendarVisibilityKey(calendarId: string): string {
  if (calendarId.trim().length === 0) throw new Error('calendarId must not be empty');
  return `calendar_visible:${calendarId}`;
}

function parseEventEditorTab(value: unknown): EventEditorTab | null {
  return value === 'fuzzy' || value === 'exact' ? value : null;
}

export class SqliteSettingsRepository implements SettingsRepository {
  constructor(private readonly database: AppDatabase) {}

  async getDefaultExactDuration(): Promise<ExactDuration> {
    const row = await this.database.first<SettingRow>(
      'SELECT value_json FROM app_settings WHERE key = $key',
      { $key: 'default_exact_duration' },
    );
    if (!row) return DEFAULT_DURATION;
    const parsed = parseExactDuration(parseJson(row.value_json));
    return parsed.ok ? parsed.value : DEFAULT_DURATION;
  }

  async setDefaultExactDuration(value: ExactDuration, updatedAt: string): Promise<void> {
    const parsed = parseExactDuration(value);
    if (!parsed.ok) throw new Error('Invalid default exact duration');
    await this.database.run(
      `INSERT INTO app_settings (key, value_json, updated_at)
       VALUES ($key, $valueJson, $updatedAt)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      {
        $key: 'default_exact_duration',
        $valueJson: JSON.stringify(parsed.value),
        $updatedAt: updatedAt,
      },
    );
  }

  async getUndeterminedFadeMinutes(): Promise<number> {
    const row = await this.database.first<SettingRow>(
      'SELECT value_json FROM app_settings WHERE key = $key',
      { $key: 'undetermined_fade_minutes' },
    );
    if (!row) return DEFAULT_FADE_MINUTES;
    const value = parseJson(row.value_json);
    return Number.isInteger(value) && Number(value) > 0 ? Number(value) : DEFAULT_FADE_MINUTES;
  }

  async getCalendarVisible(calendarId: string): Promise<boolean> {
    const row = await this.database.first<SettingRow>(
      'SELECT value_json FROM app_settings WHERE key = $key',
      { $key: getCalendarVisibilityKey(calendarId) },
    );
    if (!row) return true;
    const value = parseJson(row.value_json);
    return typeof value === 'boolean' ? value : true;
  }

  async setCalendarVisible(calendarId: string, visible: boolean, updatedAt: string): Promise<void> {
    await this.database.run(
      `INSERT INTO app_settings (key, value_json, updated_at)
       VALUES ($key, $valueJson, $updatedAt)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      {
        $key: getCalendarVisibilityKey(calendarId),
        $valueJson: JSON.stringify(visible),
        $updatedAt: updatedAt,
      },
    );
  }

  async getLastEventEditorTab(): Promise<EventEditorTab> {
    const row = await this.database.first<SettingRow>(
      'SELECT value_json FROM app_settings WHERE key = $key',
      { $key: 'last_event_editor_tab' },
    );
    if (!row) return DEFAULT_EVENT_EDITOR_TAB;
    return parseEventEditorTab(parseJson(row.value_json)) ?? DEFAULT_EVENT_EDITOR_TAB;
  }

  async setLastEventEditorTab(tab: EventEditorTab, updatedAt: string): Promise<void> {
    if (parseEventEditorTab(tab) === null) throw new Error('Invalid event editor tab');
    await this.database.run(
      `INSERT INTO app_settings (key, value_json, updated_at)
       VALUES ($key, $valueJson, $updatedAt)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      {
        $key: 'last_event_editor_tab',
        $valueJson: JSON.stringify(tab),
        $updatedAt: updatedAt,
      },
    );
  }

  async getThisWeekDeadlineWeekday(): Promise<ThisWeekDeadlineWeekday> {
    const row = await this.database.first<SettingRow>(
      'SELECT value_json FROM app_settings WHERE key = $key',
      { $key: 'this_week_deadline_weekday' },
    );
    const value = row ? parseJson(row.value_json) : undefined;
    return value === 5 || value === 6 || value === 7 ? value : DEFAULT_THIS_WEEK_DEADLINE;
  }

  async setThisWeekDeadlineWeekday(value: ThisWeekDeadlineWeekday, updatedAt: string): Promise<void> {
    if (value !== 5 && value !== 6 && value !== 7) throw new Error('Invalid this-week deadline weekday');
    await this.database.run(
      `INSERT INTO app_settings (key, value_json, updated_at)
       VALUES ($key, $valueJson, $updatedAt)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      { $key: 'this_week_deadline_weekday', $valueJson: JSON.stringify(value), $updatedAt: updatedAt },
    );
  }
}
