import { render, userEvent } from '@testing-library/react-native';
import { FormattedNoteToolbar } from '../formatted-note-editor/formatted-note-toolbar';

jest.mock('@/global.css', () => ({}));

describe('書式付きメモtoolbar', () => {
  test('書式状態とlink可否をアクセシビリティ状態で示して操作を通知する', async () => {
    const onToggleBold = jest.fn();
    const onOpenLink = jest.fn();
    const user = userEvent.setup();
    const view = await render(<FormattedNoteToolbar
      disabled={false}
      state={{
        bold: true,
        italic: false,
        bulletList: false,
        orderedList: false,
        taskList: false,
        linkUrl: 'https://example.com/',
        dirty: true,
      }}
      onToggleBold={onToggleBold}
      onToggleItalic={jest.fn()}
      onToggleBulletList={jest.fn()}
      onToggleOrderedList={jest.fn()}
      onToggleTaskList={jest.fn()}
      onOpenLink={onOpenLink}
    />);

    expect(view.getByLabelText('太字').props.accessibilityState)
      .toEqual({ disabled: false, selected: true });
    expect(view.getByLabelText('斜体').props.accessibilityState)
      .toEqual({ disabled: false, selected: false });
    await user.press(view.getByLabelText('太字'));
    await user.press(view.getByLabelText('選択したリンクを開く'));
    expect(onToggleBold).toHaveBeenCalledTimes(1);
    expect(onOpenLink).toHaveBeenCalledWith('https://example.com/');
  });

  test('画面幅に合わせて操作を折り返し、リンク未選択時も44pt以上のボタンを表示する', async () => {
    const view = await render(<FormattedNoteToolbar
      disabled={false}
      state={{
        bold: false,
        italic: false,
        bulletList: false,
        orderedList: false,
        taskList: false,
        linkUrl: null,
        dirty: false,
      }}
      onToggleBold={jest.fn()}
      onToggleItalic={jest.fn()}
      onToggleBulletList={jest.fn()}
      onToggleOrderedList={jest.fn()}
      onToggleTaskList={jest.fn()}
      onOpenLink={jest.fn()}
    />);

    const linkButton = view.getByLabelText('選択したリンクを開く');
    expect(linkButton).toBeDisabled();
    expect(view.getByText('リンクを閲覧')).toBeOnTheScreen();
    expect(linkButton.parent).toHaveStyle({ flexDirection: 'row', flexWrap: 'wrap' });
    expect(view.getAllByRole('button')).toHaveLength(6);
    for (const button of view.getAllByRole('button')) {
      expect(button).toHaveStyle({ minHeight: 44, minWidth: 44, maxWidth: '100%' });
    }
  });
});
