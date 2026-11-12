import { fireEvent, render, screen } from '@testing-library/react-native';
import { DefaultExactDurationSettingsSection } from '../default-exact-duration-settings-section';
import type { DefaultExactDurationSettingsState } from '../../hooks/use-default-exact-duration-settings';

jest.mock('@/global.css', () => ({}));
jest.mock('@/hooks/use-reduce-motion', () => ({ useReduceMotion: () => true }));
const state: DefaultExactDurationSettingsState = { status: 'ready', value: { type: 'fixed', minutes: 60 },
  error: null, isSaving: false, reload: jest.fn(), setValue: jest.fn() };

describe('初期長設定の表示', () => {
  it('6候補と選択印を表示し選んだ値を通知する', async () => {
    await render(<DefaultExactDurationSettingsSection state={state} />);
    await fireEvent.press(screen.getByRole('button', { name: '予定の初期の長さ、1時間' }));
    for (const name of ['長さなし', '10分', '15分', '30分', '1時間', '未定']) {
      expect(screen.getByRole('button', { name: name === '1時間' ? '1時間、選択中' : name })).toBeOnTheScreen();
    }
    expect(screen.getByRole('button', { name: '1時間、選択中' }).props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: '未定' }));
    expect(state.setValue).toHaveBeenCalledWith({ type: 'undetermined' });
  });
  it('候補外の固定長を丸めず表示し他の候補を選べる', async () => {
    await render(<DefaultExactDurationSettingsSection state={{ ...state, value: { type: 'fixed', minutes: 45 } }} />);
    await fireEvent.press(screen.getByRole('button', { name: '予定の初期の長さ、45分' }));
    expect(screen.getByRole('button', { name: '45分（現在の設定）、選択中' })).toBeOnTheScreen();
  });
  it('読込失敗ではこの項目だけ操作を止めて再読込みできる', async () => {
    await render(<DefaultExactDurationSettingsSection state={{ ...state, status: 'error', error: '設定を読み込めませんでした。' }} />);
    expect(screen.getByRole('button', { name: '予定の初期の長さ、1時間' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: '初期の長さを再読み込み' }));
    expect(state.reload).toHaveBeenCalled();
  });
});
