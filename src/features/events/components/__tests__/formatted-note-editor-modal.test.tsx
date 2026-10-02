import React from 'react';
import { Alert } from 'react-native';
import { act, render, userEvent } from '@testing-library/react-native';
import type { EventNoteDocumentV1 } from '@/domain/calendar/event-note';
import { FormattedNoteEditorModal } from '../formatted-note-editor/formatted-note-editor-modal';

jest.mock('@/global.css', () => ({}));

const mockCommands = {
  toggleBold: jest.fn(),
  toggleItalic: jest.fn(),
  toggleBulletList: jest.fn(),
  toggleOrderedList: jest.fn(),
  toggleTaskList: jest.fn(),
  requestComplete: jest.fn(),
};
type MockDomProps = {
  onReady: () => Promise<void>;
  onStateChange: (state: unknown) => Promise<void>;
  onComplete: (document: unknown) => Promise<void>;
  onConversionFailure: () => Promise<void>;
  onFailure: () => Promise<void>;
};

let mockDomProps: MockDomProps;
let mockDomMountCount = 0;

jest.mock('../formatted-note-editor/formatted-note-editor.dom', () => {
  const ReactModule = jest.requireActual<typeof React>('react');
  const { View: NativeView } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: ReactModule.forwardRef((
      props: MockDomProps,
      ref,
    ) => {
      mockDomProps = props;
      ReactModule.useImperativeHandle(ref, () => mockCommands);
      ReactModule.useEffect(() => { mockDomMountCount += 1; }, []);
      return ReactModule.createElement(NativeView, { testID: 'formatted-note-dom' });
    }),
  };
});

const document: EventNoteDocumentV1 = {
  version: 1,
  blocks: [{ type: 'paragraph', content: [{ text: '最新' }] }],
};

describe('全画面の書式付きメモeditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDomMountCount = 0;
  });

  test('ready後だけ完了要求を1回送りDOMの最新文書を返すまで確定しない', async () => {
    const onComplete = jest.fn();
    const user = userEvent.setup();
    const view = await render(<FormattedNoteEditorModal visible initialDocument={null} disabled={false} linkError={null}
      onCancel={jest.fn()} onComplete={onComplete} onOpenLink={jest.fn()} />);

    expect(view.getByLabelText('完了')).toBeDisabled();
    await act(async () => { await mockDomProps.onReady(); });
    await user.press(view.getByLabelText('完了'));
    await user.press(view.getByLabelText('完了'));
    expect(mockCommands.requestComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();

    await act(async () => { await mockDomProps.onComplete(document); });
    expect(onComplete).toHaveBeenCalledWith(document);
  });

  test('DOMの選択状態をtoolbarへ反映しcommandをeditorへ送る', async () => {
    const view = await render(<FormattedNoteEditorModal visible initialDocument={null} disabled={false} linkError={null}
      onCancel={jest.fn()} onComplete={jest.fn()} onOpenLink={jest.fn()} />);
    await act(async () => { await mockDomProps.onReady(); });
    await act(async () => {
      await mockDomProps.onStateChange({
        bold: true,
        italic: false,
        bulletList: false,
        orderedList: false,
        taskList: false,
        linkUrl: null,
        dirty: true,
      });
    });

    expect(view.getByLabelText('太字').props.accessibilityState.selected).toBe(true);
    const user = userEvent.setup();
    await user.press(view.getByLabelText('太字'));
    expect(mockCommands.toggleBold).toHaveBeenCalledTimes(1);
  });

  test('不正な完了payloadではdraftを上書きせずeditorを閉じない', async () => {
    const onComplete = jest.fn();
    const view = await render(<FormattedNoteEditorModal visible initialDocument={null} disabled={false} linkError={null}
      onCancel={jest.fn()} onComplete={onComplete} onOpenLink={jest.fn()} />);
    await act(async () => {
      await mockDomProps.onReady();
      await mockDomProps.onComplete({ version: 2, blocks: [] });
    });

    expect(onComplete).not.toHaveBeenCalled();
    expect(view.getByText('メモを更新できませんでした。もう一度お試しください。')).toBeOnTheScreen();
  });

  test('DOM文書の変換失敗ではdraftを上書きせず同じeditorで再試行できる', async () => {
    const onComplete = jest.fn();
    const user = userEvent.setup();
    const view = await render(<FormattedNoteEditorModal visible initialDocument={document}
      disabled={false} linkError={null} onCancel={jest.fn()} onComplete={onComplete}
      onOpenLink={jest.fn()} />);
    await act(async () => {
      await mockDomProps.onReady();
      await mockDomProps.onConversionFailure();
    });

    expect(onComplete).not.toHaveBeenCalled();
    expect(view.getByText('メモを更新できませんでした。もう一度お試しください。')).toBeOnTheScreen();
    expect(view.getByTestId('formatted-note-dom')).toBeOnTheScreen();
    expect(view.getByLabelText('完了')).toBeEnabled();

    await user.press(view.getByLabelText('再試行'));
    expect(mockCommands.requestComplete).toHaveBeenCalledTimes(1);
    expect(mockDomMountCount).toBe(1);
  });

  test('DOMの初期化失敗では再試行時にeditorを再マウントする', async () => {
    const user = userEvent.setup();
    const view = await render(<FormattedNoteEditorModal visible initialDocument={document}
      disabled={false} linkError={null} onCancel={jest.fn()} onComplete={jest.fn()}
      onOpenLink={jest.fn()} />);
    await act(async () => { await mockDomProps.onFailure(); });

    await user.press(view.getByLabelText('再試行'));
    expect(mockCommands.requestComplete).not.toHaveBeenCalled();
    expect(mockDomMountCount).toBe(2);
  });

  test('変更後のキャンセルは破棄確認を経てから閉じる', async () => {
    const onCancel = jest.fn();
    const user = userEvent.setup();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const view = await render(<FormattedNoteEditorModal visible initialDocument={null} disabled={false} linkError={null}
      onCancel={onCancel} onComplete={jest.fn()} onOpenLink={jest.fn()} />);
    await act(async () => {
      await mockDomProps.onStateChange({
        bold: false,
        italic: false,
        bulletList: false,
        orderedList: false,
        taskList: false,
        linkUrl: null,
        dirty: false,
      });
      await mockDomProps.onStateChange({
        bold: false,
        italic: false,
        bulletList: false,
        orderedList: false,
        taskList: false,
        linkUrl: null,
        dirty: true,
      });
    });

    await user.press(view.getByLabelText('キャンセル'));
    expect(onCancel).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0][2];
    buttons?.find((button) => button.text === '破棄')?.onPress?.();
    expect(onCancel).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });

  test('外部browserを開けない場合はeditor内に固定文言を表示する', async () => {
    const view = await render(<FormattedNoteEditorModal visible initialDocument={null}
      disabled={false} linkError="リンクを開けませんでした。"
      onCancel={jest.fn()} onComplete={jest.fn()} onOpenLink={jest.fn()} />);
    expect(view.getByRole('alert')).toHaveTextContent('リンクを開けませんでした。');
  });
});
