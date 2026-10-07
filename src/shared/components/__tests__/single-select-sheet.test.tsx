import { fireEvent, render, userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SingleSelectSheet } from '../single-select-sheet';

jest.mock('@/global.css', () => ({}));
jest.mock('@/hooks/use-reduce-motion', () => ({ useReduceMotion: jest.fn(() => false) }));

const options = [
  { value: 'morning', label: '朝', group: 'この日' },
  { value: 'this-week', label: '今週中', group: '週単位' },
] as const;

describe('共通の単一選択シート', () => {
  it('groupと現在値を示し、選択した値を返して閉じる', async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    const onClose = jest.fn();
    const view = await render(
      <SingleSelectSheet visible title="時間帯" value="morning" options={options}
        onSelect={onSelect} onClose={onClose} />,
    );

    expect(view.getByText('この日')).toBeOnTheScreen();
    expect(view.getByText('週単位')).toBeOnTheScreen();
    expect(view.getByLabelText('朝、この日、選択中').props.accessibilityState)
      .toMatchObject({ selected: true });

    await user.press(view.getByLabelText('今週中、週単位'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('this-week');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('背景、取消、Android backは値を変えず一度だけ閉じる', async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    const onClose = jest.fn();
    const view = await render(
      <SingleSelectSheet visible title="時間帯" value="morning" options={options}
        onSelect={onSelect} onClose={onClose} />,
    );

    fireEvent.press(view.getByTestId('single-select-sheet.backdrop', { includeHiddenElements: true }));
    await user.press(view.getByLabelText('キャンセル'));
    view.getByTestId('single-select-sheet.modal').props.onRequestClose();

    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('選択肢が空、または現在値が候補にない場合も安全に表示する', async () => {
    const empty = await render(
      <SingleSelectSheet visible title="時間帯" value="unknown" options={[]}
        onSelect={jest.fn()} onClose={jest.fn()} />,
    );
    expect(empty.getByText('選択肢がありません')).toBeOnTheScreen();

    const unknown = await render(
      <SingleSelectSheet visible title="時間帯" value="unknown" options={options}
        onSelect={jest.fn()} onClose={jest.fn()} />,
    );
    expect(unknown.getByLabelText('朝、この日').props.accessibilityState)
      .toMatchObject({ selected: false });
    expect(unknown.getByLabelText('今週中、週単位').props.accessibilityState)
      .toMatchObject({ selected: false });
  });

  it('disabledでは選択できず、操作領域を44pt以上にする', async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    const view = await render(
      <SingleSelectSheet visible title="時間帯" value="morning" options={options} disabled
        onSelect={onSelect} onClose={jest.fn()} />,
    );
    const option = view.getByLabelText('今週中、週単位');

    expect(option.props.accessibilityState).toMatchObject({ disabled: true, selected: false });
    expect(StyleSheet.flatten(option.props.style).minHeight).toBeGreaterThanOrEqual(44);
    await user.press(option);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('同じ名称の候補もvalueとgroupで別々に扱う', async () => {
    const duplicateOptions = [
      { value: 'day', label: '後半', group: 'この日' },
      { value: 'week', label: '後半', group: '週単位' },
    ] as const;
    const view = await render(
      <SingleSelectSheet visible title="時間帯" value="week" options={duplicateOptions}
        onSelect={jest.fn()} onClose={jest.fn()} />,
    );

    expect(view.getByLabelText('後半、この日').props.accessibilityState.selected).toBe(false);
    expect(view.getByLabelText('後半、週単位、選択中').props.accessibilityState.selected).toBe(true);
  });
});
