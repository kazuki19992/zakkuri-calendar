import { createDatabaseDouble } from '@/test/create-database-double';
import { SqliteSettingsRepository } from '../settings-repository';

const now = '2026-11-12T00:00:00.000Z';
const fixed60 = { type: 'fixed', minutes: 60 };

describe('予定の初期長の保存互換性', () => {
  it.each([
    [null, fixed60], ['broken', fixed60], ['null', fixed60],
    ['{"type":"instant"}', fixed60], ['{"type":"fixed","minutes":45}', { type: 'fixed', minutes: 45 }],
    ['{"type":"undetermined"}', { type: 'undetermined' }],
    ['{"version":1,"duration":{"type":"instant"}}', { type: 'instant' }],
    ['{"version":1,"duration":{"type":"undetermined"}}', { type: 'undetermined' }],
    ['{"version":1,"duration":{"type":"fixed","minutes":15}}', { type: 'fixed', minutes: 15 }],
    ['{"version":2,"duration":{"type":"instant"}}', fixed60],
    ['{"version":1,"type":"undetermined"}', fixed60],
    ['{"version":1,"duration":{"type":"fixed","minutes":0}}', fixed60],
  ])('保持値%sを安全に読み、fallbackでは書き換えない', async (json, expected) => {
    const db = createDatabaseDouble();
    db.first.mockResolvedValue(json === null ? null : { value_json: json });
    expect(await new SqliteSettingsRepository(db.database).getDefaultExactDuration()).toEqual(expected);
    expect(db.run).not.toHaveBeenCalled();
  });

  it('明示的に選んだ長さなしをversion付きの同じキーへ保存する', async () => {
    const db = createDatabaseDouble();
    await new SqliteSettingsRepository(db.database).setDefaultExactDuration({ type: 'instant' }, now);
    expect(db.run).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT(key) DO UPDATE'), {
      $key: 'default_exact_duration', $valueJson: '{"version":1,"duration":{"type":"instant"}}', $updatedAt: now,
    });
  });
});
