'use dom';

import { useCallback, useEffect, useRef, type Ref } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { useDOMImperativeHandle, type DOMImperativeFactory } from 'expo/dom';
import type { EventNoteDocumentV1 } from '@/domain/calendar/event-note';
import { createEventNoteExtensions } from '../../event-note/editor-extensions';
import { fromTiptapDocument, toTiptapDocument } from '../../event-note/tiptap-note-adapter';
import { createEditorSelectionState } from './formatted-note-editor-state';

export type EditorTheme = Readonly<{
  background: string;
  text: string;
  textSecondary: string;
  accent: string;
}>;

export type EditorSelectionState = Readonly<{
  bold: boolean;
  italic: boolean;
  bulletList: boolean;
  orderedList: boolean;
  taskList: boolean;
  linkUrl: string | null;
  dirty: boolean;
}>;

export interface FormattedNoteEditorDOMRef extends DOMImperativeFactory {
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleBulletList: () => void;
  toggleOrderedList: () => void;
  toggleTaskList: () => void;
  requestComplete: () => void;
}

type Props = Readonly<{
  ref: Ref<FormattedNoteEditorDOMRef>;
  initialDocument: EventNoteDocumentV1 | null;
  theme: EditorTheme;
  onReady(): Promise<void>;
  onStateChange(state: EditorSelectionState): Promise<void>;
  onComplete(document: EventNoteDocumentV1 | null): Promise<void>;
  onFailure(): Promise<void>;
  dom?: import('expo/dom').DOMProps;
}>;

export default function FormattedNoteEditorDOM({
  ref,
  initialDocument,
  theme,
  onReady,
  onStateChange,
  onComplete,
  onFailure,
}: Props) {
  const dirtyRef = useRef(false);
  const editor = useEditor({
    extensions: createEventNoteExtensions(),
    content: toTiptapDocument(initialDocument),
    immediatelyRender: false,
    onCreate: ({ editor: createdEditor }) => {
      void onReady();
      createdEditor.commands.focus('end');
    },
    onUpdate: ({ editor: updatedEditor }) => {
      dirtyRef.current = true;
      void onStateChange(createEditorSelectionState(updatedEditor, true));
    },
  });

  const reportState = useCallback((): void => {
    if (editor === null) return;
    void onStateChange(createEditorSelectionState(editor, dirtyRef.current));
  }, [editor, onStateChange]);

  useEffect(() => {
    if (editor === null) return;
    editor.on('selectionUpdate', reportState);
    editor.on('transaction', reportState);
    reportState();
    return () => {
      editor.off('selectionUpdate', reportState);
      editor.off('transaction', reportState);
    };
  }, [editor, reportState]);

  // useDOMImperativeHandleはExpo DOM Componentsが定めるnative bridge用ref境界。
  useDOMImperativeHandle(ref, () => ({
    toggleBold: () => { editor?.chain().focus().toggleBold().run(); },
    toggleItalic: () => { editor?.chain().focus().toggleItalic().run(); },
    toggleBulletList: () => { editor?.chain().focus().toggleBulletList().run(); },
    toggleOrderedList: () => { editor?.chain().focus().toggleOrderedList().run(); },
    toggleTaskList: () => { editor?.chain().focus().toggleTaskList().run(); },
    requestComplete: () => {
      if (editor === null) {
        void onFailure();
        return;
      }
      void onComplete(fromTiptapDocument(editor.getJSON()));
    },
  }), [editor, onComplete, onFailure]);

  return (
    <main style={{ background: theme.background, color: theme.text, minHeight: '100vh' }}>
      <style>{`
        html, body, #root { background: ${theme.background}; margin: 0; min-height: 100%; }
        .event-note-editor { box-sizing: border-box; font: 17px/1.55 system-ui, sans-serif;
          min-height: 100vh; outline: none; padding: 16px; }
        .event-note-editor p { margin: 0 0 0.75em; }
        .event-note-editor ul, .event-note-editor ol { padding-left: 1.6em; }
        .event-note-editor ul[data-type="taskList"] { list-style: none; padding-left: 0; }
        .event-note-editor ul[data-type="taskList"] li { align-items: flex-start; display: flex; gap: 8px; }
        .event-note-editor ul[data-type="taskList"] li > label { align-items: center; display: flex;
          justify-content: center; min-height: 44px; min-width: 44px; }
        .event-note-editor ul[data-type="taskList"] input { height: 22px; width: 22px; }
        .event-note-editor p.is-editor-empty:first-child::before { color: ${theme.textSecondary};
          content: attr(data-placeholder); float: left; height: 0; pointer-events: none; }
        .event-note-editor a { color: ${theme.accent}; text-decoration: underline; }
      `}</style>
      <EditorContent editor={editor} className="event-note-editor"
        onClickCapture={(event) => {
          const target = event.target;
          if (target instanceof Element && target.closest('a') !== null) event.preventDefault();
        }} />
    </main>
  );
}
