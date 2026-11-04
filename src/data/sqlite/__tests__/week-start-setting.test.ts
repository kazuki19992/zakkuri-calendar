import { createDatabaseDouble } from '@/test/create-database-double';
import { SqliteSettingsRepository } from '../settings-repository';

describe('週開始曜日の設定保存', () => {
  it.each([null, '{', '"0"', 'true', '2', '{}'])('欠損や不正値 %s は月曜へ戻す', async (json) => {
    const db = createDatabaseDouble();
    db.first.mockResolvedValue(json === null ? null : { value_json: json });
    await expect(new SqliteSettingsRepository(db.database).getCalendarWeekStartsOn()).resolves.toBe(1);
  });

  it.each([0, 1] as const)('有効な曜日 %s を読み書きできる', async (value) => {
    const db = createDatabaseDouble();
    db.first.mockResolvedValue({ value_json: JSON.stringify(value) });
    const settings = new SqliteSettingsRepository(db.database);
    await expect(settings.getCalendarWeekStartsOn()).resolves.toBe(value);
    await settings.setCalendarWeekStartsOn(value, '2026-11-04T00:00:00Z');
    expect(db.run).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT(key)'), {
      $key: 'calendar_week_starts_on', $valueJson: JSON.stringify(value), $updatedAt: '2026-11-04T00:00:00Z',
    });
  });

  it('不正な曜日を書き込まずDB読込失敗も隠さない', async () => {
    const db = createDatabaseDouble();
    const settings = new SqliteSettingsRepository(db.database);
    await expect(settings.setCalendarWeekStartsOn(2 as 0, '')).rejects.toThrow();
    expect(db.run).not.toHaveBeenCalled();
    db.first.mockRejectedValue(new Error('db unavailable'));
    await expect(settings.getCalendarWeekStartsOn()).rejects.toThrow('db unavailable');
  });
});
