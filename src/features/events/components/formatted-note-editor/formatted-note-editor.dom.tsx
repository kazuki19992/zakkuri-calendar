'use dom';

import { useCallback, useEffect, useRef, type Ref } from 'react';
import {InlineNoteDOMSession} from '../../event-note/inline-note-dom-session';
import type {NoteUpdate,NoteResponse} from '../../event-note/inline-note-session';
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
  requestSnapshot: DOMImperativeFactory[string];
  releaseSnapshot: DOMImperativeFactory[string];
  blur: () => void;
}

type Props = Readonly<{
  ref: Ref<FormattedNoteEditorDOMRef>;
  initialDocument: EventNoteDocumentV1 | null;
  theme: EditorTheme;
  onReady(): Promise<void>;
  onStateChange(state: EditorSelectionState): Promise<void>;
  onConversionFailure(): Promise<void>;
  onFailure(): Promise<void>;
  sessionId?:number;
  disabled?:boolean;
  fontScale?:number;
  onSnapshot?(response:NoteResponse):Promise<void>;
  onSnapshotFailure?(requestId:number):Promise<void>;
  onDocumentChange?(update:NoteUpdate):Promise<void>;
  onFocusChange?(focused:boolean):Promise<void>;
  onContentHeight?(height:number):Promise<void>;
  dom?: import('expo/dom').DOMProps;
}>;

export default function FormattedNoteEditorDOM({
  ref,
  initialDocument,
  theme,
  onReady,
  onStateChange,
  onConversionFailure,
  onFailure, sessionId=1,disabled=false,fontScale=1,onSnapshot,onSnapshotFailure,onDocumentChange,onFocusChange,onContentHeight,
}: Props) {
  const dirtyRef = useRef(false);
  const revision=useRef(0);
  const snapshots=useRef<InlineNoteDOMSession|null>(null);
  const editor = useEditor({
    extensions: createEventNoteExtensions(),
    content: toTiptapDocument(initialDocument),
    immediatelyRender: false,
    editable: false,
    editorProps:{attributes:{role:'textbox','aria-label':'メモ本文','aria-multiline':'true'}},

    onUpdate: ({ editor: updatedEditor }) => {
      dirtyRef.current = true;
      revision.current+=1;
      const result=fromTiptapDocument(updatedEditor.getJSON());
      if(result.ok)void onDocumentChange?.({sessionId,revision:revision.current,document:result.value});
      else void onConversionFailure();
      void onStateChange(createEditorSelectionState(updatedEditor, true));
    },
  });

  useEffect(()=>{
    if(!editor)return;
    const controller=new InlineNoteDOMSession({
      composing:()=>editor.view.composing,
      blur:()=>editor.view.dom.blur(),
      setEditable:value=>editor.setEditable(value,false),
      read:()=>{const result=fromTiptapDocument(editor.getJSON());if(!result.ok)throw new Error('Invalid document');return {revision:revision.current,document:result.value};},
      respond:(requestId,value,document)=>{void onSnapshot?.({sessionId,requestId,revision:value,document});},
      fail:requestId=>{void onSnapshotFailure?.(requestId);},
    });
    snapshots.current=controller;
    void onReady();
    return ()=>{controller.dispose();if(snapshots.current===controller)snapshots.current=null;};
  },[editor,sessionId,onReady,onSnapshot,onSnapshotFailure]);
  useEffect(()=>{snapshots.current?.setDisabled(disabled||editor===null);},[disabled,editor]);
  const contentRef=useRef<HTMLElement|null>(null);
  useEffect(()=>{
    const element=contentRef.current;if(!element)return;
    const report=()=>{void onContentHeight?.(element.scrollHeight);};
    const observer=new ResizeObserver(report);observer.observe(element);report();
    return ()=>observer.disconnect();
  },[onContentHeight]);
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
    toggleBold: () => { if(editor?.isEditable)editor.chain().focus().toggleBold().run(); },
    toggleItalic: () => { if(editor?.isEditable)editor.chain().focus().toggleItalic().run(); },
    toggleBulletList: () => { if(editor?.isEditable)editor.chain().focus().toggleBulletList().run(); },
    toggleOrderedList: () => { if(editor?.isEditable)editor.chain().focus().toggleOrderedList().run(); },
    toggleTaskList: () => { if(editor?.isEditable)editor.chain().focus().toggleTaskList().run(); },
    requestSnapshot:requestId=>{if(typeof requestId==='number')snapshots.current?.request(requestId);},
    releaseSnapshot:requestId=>{if(typeof requestId==='number')snapshots.current?.release(requestId);},
    blur:()=>editor?.view.dom.blur(),
  }), [editor,snapshots]);

  return (
    <main ref={contentRef} style={{ background: theme.background, color: theme.text }}
      onFocusCapture={()=>{void onFocusChange?.(true);}}
      onBlurCapture={()=>{void onFocusChange?.(false);}}
      onCompositionEnd={()=>snapshots.current?.compositionEnd()}>
      <style>{`
        html, body, #root { background: ${theme.background}; margin: 0; }
        .event-note-editor { box-sizing: border-box; font: ${17*fontScale}px/1.55 system-ui, sans-serif;
          min-height: 100px; outline: none; padding: 8px; }
        .event-note-editor .tiptap { outline: none; min-height: 80px; }
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
