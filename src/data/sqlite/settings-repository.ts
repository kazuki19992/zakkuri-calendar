import { parseExactDuration, type EventEditorTab, type ExactDuration } from '@/domain/calendar/event';
import {
  DEFAULT_CALENDAR_VIEW_MODE,
  parseCalendarViewMode,
  type CalendarViewMode,
} from '@/domain/calendar/calendar-view-mode';
import type { SettingsRepository } from '@/domain/calendar/repositories';
import type { AppDatabase } from './database';
import { DEFAULT_HOLIDAY_PREFERENCES, parseHolidayPreferences, type HolidayPreferencesV1 } from '@/domain/calendar/holiday-preferences';
import type { WeekStartsOn } from '@/domain/calendar/month';
import { DEFAULT_CALENDAR_WEEK_STARTS_ON, parseCalendarWeekStartsOn } from '@/domain/calendar/week-start';
import { DEFAULT_EXACT_DURATION } from '@/domain/calendar/default-exact-duration';
import type { ThisWeekDeadlineWeekday } from '@/domain/temporal/relative-date-resolution';

type SettingRow = Readonly<{ value_json: string }>;

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

  async getHolidayPreferences(): Promise<HolidayPreferencesV1> {
    const row = await this.database.first<SettingRow>('SELECT value_json FROM app_settings WHERE key = $key', { $key: 'holiday_preferences' });
    return parseHolidayPreferences(row ? parseJson(row.value_json) : undefined) ?? DEFAULT_HOLIDAY_PREFERENCES;
  }

  async setHolidayPreferences(value: HolidayPreferencesV1, updatedAt: string): Promise<void> {
    const parsed = parseHolidayPreferences(value);
    if (parsed === null) throw new Error('Invalid holiday preferences');
    await this.database.run(
      `INSERT INTO app_settings (key, value_json, updated_at) VALUES ($key, $valueJson, $updatedAt)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      { $key: 'holiday_preferences', $valueJson: JSON.stringify(parsed), $updatedAt: updatedAt },
    );
  }

  async getCalendarWeekStartsOn(): Promise<WeekStartsOn> {
    const row = await this.database.first<SettingRow>(
      'SELECT value_json FROM app_settings WHERE key = $key',
      { $key: 'calendar_week_starts_on' },
    );
    return parseCalendarWeekStartsOn(row ? parseJson(row.value_json) : undefined)
      ?? DEFAULT_CALENDAR_WEEK_STARTS_ON;
  }

  async setCalendarWeekStartsOn(value: WeekStartsOn, updatedAt: string): Promise<void> {
    if (parseCalendarWeekStartsOn(value) === null) throw new Error('Invalid calendar week start');
    await this.database.run(
      `INSERT INTO app_settings (key, value_json, updated_at)
       VALUES ($key, $valueJson, $updatedAt)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      { $key: 'calendar_week_starts_on', $valueJson: JSON.stringify(value), $updatedAt: updatedAt },
    );
  }

  async getDefaultExactDuration(): Promise<ExactDuration> {
    const row = await this.database.first<SettingRow>(
      'SELECT value_json FROM app_settings WHERE key = $key',
      { $key: 'default_exact_duration' },
    );
    if (!row) return DEFAULT_EXACT_DURATION;
    const value = parseJson(row.value_json);
    if (typeof value === 'object' && value !== null && 'version' in value) {
      if (value.version !== 1 || !('duration' in value)) return DEFAULT_EXACT_DURATION;
      const parsed = parseExactDuration(value.duration);
      return parsed.ok ? parsed.value : DEFAULT_EXACT_DURATION;
    }
    const legacy = parseExactDuration(value);
    // 設定UI導入前のinstantは未選択seed。明示選択はversion付きで区別する。
    return legacy.ok && legacy.value.type !== 'instant' ? legacy.value : DEFAULT_EXACT_DURATION;
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
        $valueJson: JSON.stringify({ version: 1, duration: parsed.value }),
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

  async getLastCalendarViewMode(): Promise<CalendarViewMode> {
    const row = await this.database.first<SettingRow>(
      'SELECT value_json FROM app_settings WHERE key = $key',
      { $key: 'last_calendar_view_mode' },
    );
    if (!row) return DEFAULT_CALENDAR_VIEW_MODE;
    return parseCalendarViewMode(parseJson(row.value_json)) ?? DEFAULT_CALENDAR_VIEW_MODE;
  }

  async setLastCalendarViewMode(mode: CalendarViewMode, updatedAt: string): Promise<void> {
    if (parseCalendarViewMode(mode) === null) throw new Error('Invalid calendar view mode');
    await this.database.run(
      `INSERT INTO app_settings (key, value_json, updated_at)
       VALUES ($key, $valueJson, $updatedAt)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      {
        $key: 'last_calendar_view_mode',
        $valueJson: JSON.stringify(mode),
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
