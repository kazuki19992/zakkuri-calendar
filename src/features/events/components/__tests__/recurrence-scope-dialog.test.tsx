import { render, userEvent } from '@testing-library/react-native';
import { RecurrenceScopeDialog } from '../recurrence-scope-dialog';

jest.mock('@/global.css', () => ({}));

describe('繰り返し予定の範囲選択dialog', () => {
  test('変更範囲を選択またはキャンセルできる', async () => {
    const onSelect = jest.fn();
    const onCancel = jest.fn();
    const user = userEvent.setup();
    const view = await render(<RecurrenceScopeDialog request={{
      operation: 'save',
      options: [
        { scope: 'occurrence', label: 'この予定' },
        { scope: 'following', label: 'これ以降の予定' },
        { scope: 'series', label: 'すべての予定' },
      ],
      needsExceptionResetConfirmation: false,
    }} busy={false} onSelect={onSelect} onCancel={onCancel} />);

    expect(view.getByText('変更する範囲')).toBeOnTheScreen();
    await user.press(view.getByLabelText('これ以降の予定'));
    expect(onSelect).toHaveBeenCalledWith('following');
    await user.press(view.getByLabelText('キャンセル'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test('規則変更は範囲選択後に例外resetを確認する', async () => {
    const onSelect = jest.fn();
    const user = userEvent.setup();
    const view = await render(<RecurrenceScopeDialog request={{
      operation: 'save',
      options: [
        { scope: 'following', label: 'これ以降の予定' },
        { scope: 'series', label: 'すべての予定' },
      ],
      needsExceptionResetConfirmation: true,
    }} busy={false} onSelect={onSelect} onCancel={jest.fn()} />);

    expect(view.getByText('1件だけの予定には繰り返し設定を適用できません')).toBeOnTheScreen();
    await user.press(view.getByLabelText('これ以降の予定'));
    expect(onSelect).not.toHaveBeenCalled();
    expect(view.getByText('これ以降の個別変更をリセットします')).toBeOnTheScreen();
    await user.press(view.getByLabelText('リセットして変更'));
    expect(onSelect).toHaveBeenCalledWith('following');
  });
});
