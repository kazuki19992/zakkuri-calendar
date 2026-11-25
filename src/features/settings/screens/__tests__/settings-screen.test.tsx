import { fireEvent, render, screen } from '@testing-library/react-native';
import { SettingsScreen } from '../settings-screen';

jest.mock('@/global.css', () => ({}));
jest.mock('@/hooks/use-reduce-motion', () => ({ useReduceMotion: () => true }));

const weekStart = {
  status: 'ready' as const, value: 1 as const, error: null, isSaving: false,
  setValue: jest.fn(), reload: jest.fn(),
};
const holidays = {
  status: 'ready' as const, value: { version: 1, calendarId: 'jp', adjustThisWeekDeadline: false } as const,
  error: null, isSaving: false, setValue: jest.fn(), reload: jest.fn(),
};

const duration = { status: 'ready' as const, value: { type: 'fixed' as const, minutes: 60 }, error: null, isSaving: false, reload: jest.fn(), setValue: jest.fn() };

describe('設定画面', () => {
  it('締切は時間表現の詳細へ移し、端末内の保存方針とバージョンを表示する', async () => {
    await render(<SettingsScreen duration={duration} holidays={holidays} weekStart={weekStart} version="1.0.0" />);
    expect(screen.queryByText('締切の曜日')).toBeNull();
    expect(screen.getByText('予定と設定はこの端末に保存されます。')).toBeOnTheScreen();
    expect(screen.getByText('1.0.0')).toBeOnTheScreen();
  });

  it('未定の表示時間とバックアップは設定トップから操作できる', async () => {
    const exportBackup = jest.fn();
    await render(<SettingsScreen duration={duration} holidays={holidays} weekStart={weekStart}
      backup={{ isExporting: false, error: null, exportBackup }}
      undeterminedDuration={{ state: { status: 'ready', minutes: 120, isSaving: false, error: null,
        reload: jest.fn(), saveMinutes: jest.fn() }, pendingMinutes: null, onChangeMinutes: jest.fn() }} />);
    expect(screen.getByRole('button', { name: '終了が未定の予定の表示時間、2時間' })).toBeOnTheScreen();
    const heading = screen.getByRole('header', { name: 'データ' });
    const footer = screen.getByText('予定と設定はこの端末に保存されます。');
    expect(heading.parent?.children.includes(footer)).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'バックアップを書き出す' }));
    expect(exportBackup).toHaveBeenCalledTimes(1);
  });

  it('ざっくり時間のカスタムから設定一覧を開く', async () => {
    const onOpenTemporalSettings = jest.fn();
    await render(<SettingsScreen duration={duration} holidays={holidays} weekStart={weekStart}
      onOpenTemporalSettings={onOpenTemporalSettings} />);

    const scroll = screen.getByTestId('settings.scroll');
    expect(scroll.props.contentInsetAdjustmentBehavior).toBe('automatic');
    expect(scroll.parent?.props.edges).toMatchObject({
      top: 'off', left: 'additive', bottom: 'additive', right: 'additive',
    });
    expect(screen.getByRole('header', { name: '予定の時間' })).toBeOnTheScreen();
    expect(screen.getByText('ざっくり予定の時間を変更できます。既存の予定にも反映されます。')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'ざっくり時間のカスタム' }));
    expect(onOpenTemporalSettings).toHaveBeenCalledTimes(1);
  });

  it('通知の現在の状態を表示し、詳細は専用画面で開く', async () => {
    const onOpenNotificationSettings = jest.fn();
    await render(<SettingsScreen duration={duration} holidays={holidays} weekStart={weekStart}
      onOpenNotificationSettings={onOpenNotificationSettings} notificationStatus="端末の通知：許可済み" />);
    expect(screen.queryByText('新規予定の通知')).toBeNull();
    expect(screen.getByText('端末の通知：許可済み')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: '通知設定、端末の通知：許可済み' }));
    expect(onOpenNotificationSettings).toHaveBeenCalledTimes(1);
  });

  it('週の開始曜日を共通シートで単一選択する', async () => {
    const setValue = jest.fn();
    await render(<SettingsScreen duration={duration} holidays={holidays} weekStart={{ ...weekStart, setValue }} />);
    await fireEvent.press(screen.getByRole('button', { name: '週の開始曜日、月曜日' }));
    await fireEvent.press(screen.getAllByRole('button', { name: '日曜日' })[0]);
    expect(setValue).toHaveBeenCalledWith(0);
  });

  it('週開始設定の読込失敗を再試行できる', async () => {
    const reload = jest.fn();
    await render(<SettingsScreen duration={duration} holidays={holidays} weekStart={{ ...weekStart, status: 'error', error: '設定を読み込めませんでした。', reload }} />);
    expect(screen.getByRole('button', { name: '週の開始曜日、月曜日' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: '週開始設定を再読み込み' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
