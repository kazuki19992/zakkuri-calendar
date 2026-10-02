import { createEditorSelectionState } from '../formatted-note-editor-state';

describe('メモDOMの編集状態', () => {
  test('document更新後の通知は選択状態に関係なくdirtyを即時反映する', () => {
    const reader = {
      isActive: jest.fn().mockReturnValue(false),
      getAttributes: jest.fn().mockReturnValue({}),
    };
    expect(createEditorSelectionState(reader, false).dirty).toBe(false);
    expect(createEditorSelectionState(reader, true).dirty).toBe(true);
  });
});
