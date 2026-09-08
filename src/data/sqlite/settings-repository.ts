import { parseExactDuration, type ExactDuration } from '@/domain/calendar/event';
import type { SettingsRepository } from '@/domain/calendar/repositories';
import type { AppDatabase } from './database';

type SettingRow = Readonly<{ value_json: string }>;
const DEFAULT_DURATION: ExactDuration = { type: 'instant' };
const DEFAULT_FADE_MINUTES = 120;

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
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
}
