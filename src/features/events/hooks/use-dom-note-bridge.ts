import {useCallback,useEffect,useLayoutEffect,useRef} from 'react';
import type {Editor} from '@tiptap/core';
import {InlineNoteDOMSession} from '../event-note/inline-note-dom-session';
import {fromTiptapDocument} from '../event-note/tiptap-note-adapter';
import type {NoteResponse} from '../event-note/inline-note-session';
import {createEditorSelectionState} from '../components/formatted-note-editor/formatted-note-editor-state';
import type {EditorSelectionState} from '../components/formatted-note-editor/formatted-note-editor.dom';
type Events=Readonly<{onReady():Promise<void>;onSnapshot?(value:NoteResponse):Promise<void>;onSnapshotFailure?(requestId:number):Promise<void>;onStateChange(value:EditorSelectionState):Promise<void>;onContentHeight?(height:number):Promise<void>}>;
type Input=Readonly<{editor:Editor|null;sessionId:number;disabled:boolean;getRevision():number;getDirty():boolean;events:Events}>;
export function useDOMNoteBridge({editor,sessionId,disabled,getRevision,getDirty,events}:Input){
 const controller=useRef<InlineNoteDOMSession|null>(null);
 const latest=useRef(events);
 // Expo DOMはprops受信ごとにcallback proxyを作り直す。購読の寿命から参照の変化を分離する。
 useLayoutEffect(()=>{latest.current=events;},[events]);
 useEffect(()=>{
  if(!editor)return;
  const session=new InlineNoteDOMSession({composing:()=>editor.view.composing,blur:()=>editor.view.dom.blur(),setEditable:value=>editor.setEditable(value,false),read:()=>{const result=fromTiptapDocument(editor.getJSON());if(!result.ok)throw new Error('Invalid document');return {revision:getRevision(),document:result.value};},respond:(requestId,revision,document)=>{void latest.current.onSnapshot?.({sessionId,requestId,revision,document});},fail:requestId=>{void latest.current.onSnapshotFailure?.(requestId);}});
  controller.current=session;void latest.current.onReady();
  return ()=>{session.dispose();if(controller.current===session)controller.current=null;};
 },[editor,sessionId,getRevision]);
 useEffect(()=>{if(!editor)return;const report=()=>{void latest.current.onStateChange(createEditorSelectionState(editor,getDirty()));};editor.on('selectionUpdate',report);editor.on('transaction',report);report();return ()=>{editor.off('selectionUpdate',report);editor.off('transaction',report);};},[editor,getDirty]);
 useEffect(()=>{controller.current?.setDisabled(disabled||editor===null);},[disabled,editor]);
 return {reportHeight:useCallback((height:number)=>{void latest.current.onContentHeight?.(height);},[]),requestSnapshot:useCallback((id:number)=>controller.current?.request(id),[]),releaseSnapshot:useCallback((id:number)=>controller.current?.release(id),[]),compositionEnd:useCallback(()=>controller.current?.compositionEnd(),[])};
}
