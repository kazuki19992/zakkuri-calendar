import type { EditorSelectionState } from './formatted-note-editor.dom';

export type EditorStateReader = Readonly<{
  isActive(name: string): boolean;
  getAttributes(name: string): Record<string, unknown>;
}>;

export function createEditorSelectionState(
  editor: EditorStateReader,
  dirty: boolean,
): EditorSelectionState {
  const href = editor.getAttributes('link').href;
  return {
    bold: editor.isActive('bold'),
    italic: editor.isActive('italic'),
    bulletList: editor.isActive('bulletList'),
    orderedList: editor.isActive('orderedList'),
    taskList: editor.isActive('taskList'),
    linkUrl: typeof href === 'string' ? href : null,
    dirty,
  };
}
