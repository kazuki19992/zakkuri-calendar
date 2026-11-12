/** @jest-environment node */
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
describe('ローカル通知専用のnative設定', () => {
  test('push用entitlementを生成せず、Androidの正確なアラーム宣言は維持する', () => {
    const result = execFileSync(
      process.execPath,
      [
        join(process.cwd(), 'node_modules/expo/bin/cli'),
        'config',
        '--type',
        'introspect',
        '--json',
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, EXPO_OFFLINE: '1' },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    const config = JSON.parse(result);
    expect(
      config._internal.modResults.ios.entitlements['aps-environment'],
    ).toBeUndefined();
    expect(config.android.permissions).toContain(
      'android.permission.SCHEDULE_EXACT_ALARM',
    );
  });
});
