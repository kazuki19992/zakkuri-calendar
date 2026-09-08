const { spawnSync } = require('node:child_process');
const { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const scriptPath = resolve(__dirname, '../build-local.sh');

describe('ローカルEASビルドスクリプト', () => {
  let testDirectory;
  let fakeBinDirectory;
  let invocationLogPath;

  beforeEach(() => {
    testDirectory = mkdtempSync(join(tmpdir(), 'zakkuri-calendar-build-local-'));
    fakeBinDirectory = join(testDirectory, 'bin');
    invocationLogPath = join(testDirectory, 'npx-invocations.log');
    mkdirSync(fakeBinDirectory);

    const fakeNpxPath = join(fakeBinDirectory, 'npx');
    writeFileSync(
      fakeNpxPath,
      '#!/usr/bin/env bash\nprintf "%s|%s\\n" "$EAS_LOCAL_BUILD_ARTIFACTS_DIR" "$*" >> "$INVOCATION_LOG_PATH"\n',
    );
    chmodSync(fakeNpxPath, 0o755);
  });

  afterEach(() => {
    rmSync(testDirectory, { recursive: true, force: true });
  });

  const runScript = (...args) =>
    spawnSync('/bin/bash', [scriptPath, ...args], {
      cwd: resolve(__dirname, '../..'),
      encoding: 'utf8',
      env: {
        ...process.env,
        INVOCATION_LOG_PATH: invocationLogPath,
        PATH: `${fakeBinDirectory}:${process.env.PATH}`,
      },
    });

  test('指定したprofileとiOSでbuilds配下へローカルビルドする', () => {
    const result = runScript('development', 'ios');

    expect(result.status).toBe(0);
    expect(readFileSync(invocationLogPath, 'utf8')).toBe(
      `${resolve(__dirname, '../../builds/development/ios')}|eas-cli build --platform ios --profile development --local\n`,
    );
  });

  test('platformを省略するとiOSとAndroidを順番にローカルビルドする', () => {
    const result = runScript('preview');

    expect(result.status).toBe(0);
    expect(readFileSync(invocationLogPath, 'utf8')).toBe(
      [
        `${resolve(__dirname, '../../builds/preview/ios')}|eas-cli build --platform ios --profile preview --local`,
        `${resolve(__dirname, '../../builds/preview/android')}|eas-cli build --platform android --profile preview --local`,
        '',
      ].join('\n'),
    );
  });

  test('未定義のprofileはビルドを実行せずエラーにする', () => {
    const result = runScript('staging', 'ios');

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('profileは development、preview、production のいずれかを指定してください。');
  });

  test('未対応のplatformはビルドを実行せずエラーにする', () => {
    const result = runScript('development', 'windows');

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('platformは ios、android、all のいずれかを指定してください。');
  });
});
