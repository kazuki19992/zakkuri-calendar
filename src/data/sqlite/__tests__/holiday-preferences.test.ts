import { createDatabaseDouble } from '@/test/create-database-double';
import { SqliteSettingsRepository } from '../settings-repository';

describe('祝日設定の保存', () => {
  it('不正設定の書込を拒否しDB読込失敗を隠さない', async () => {
    const db = createDatabaseDouble();
    const repository = new SqliteSettingsRepository(db.database);
    await expect(repository.setHolidayPreferences({ version: 1, calendarId: 'jp', adjustThisWeekDeadline: 'true' } as never, '')).rejects.toThrow();
    expect(db.run).not.toHaveBeenCalled();
    db.first.mockRejectedValue(new Error('db failed'));
    await expect(repository.getHolidayPreferences()).rejects.toThrow('db failed');
  });
  it.each([null, '{', '{}', '{"version":2,"calendarId":"jp","adjustThisWeekDeadline":true}', '{"version":1,"calendarId":"xx","adjustThisWeekDeadline":true}', '{"version":1,"calendarId":"jp","adjustThisWeekDeadline":"true"}'])('不正値 %s は既定設定へ戻す', async (json) => {
    const db = createDatabaseDouble();
    db.first.mockResolvedValue(json === null ? null : { value_json: json });
    await expect(new SqliteSettingsRepository(db.database).getHolidayPreferences()).resolves.toEqual({
      version: 1, calendarId: 'jp', adjustThisWeekDeadline: false,
    });
  });
  it.each(['jp', 'none'] as const)('%sの調整設定を読み書きする', async (calendarId) => {
    const value = { version: 1, calendarId, adjustThisWeekDeadline: true } as const;
    const db = createDatabaseDouble();
    db.first.mockResolvedValue({ value_json: JSON.stringify(value) });
    const settings = new SqliteSettingsRepository(db.database);
    await expect(settings.getHolidayPreferences()).resolves.toEqual(value);
    await settings.setHolidayPreferences(value, 'now');
    expect(db.run).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT(key)'), {
      $key: 'holiday_preferences', $valueJson: JSON.stringify(value), $updatedAt: 'now',
    });
  });
});
