import {act,renderHook} from '@testing-library/react-native';
import type {Editor} from '@tiptap/core';
import {useDOMNoteBridge} from '../use-dom-note-bridge';
import {eventNoteFromPlainText} from '@/domain/calendar/event-note';
function callbacks(){return {onReady:jest.fn().mockResolvedValue(undefined),onSnapshot:jest.fn().mockResolvedValue(undefined),onSnapshotFailure:jest.fn().mockResolvedValue(undefined),onStateChange:jest.fn().mockResolvedValue(undefined),onContentHeight:jest.fn().mockResolvedValue(undefined)};}
function fixture(){let composing=false;const editor={view:{get composing(){return composing;},dom:{blur:jest.fn()}},setEditable:jest.fn(),getJSON:()=>({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'最後の文字'}]}]}),isActive:()=>false,getAttributes:()=>({}),on:jest.fn(),off:jest.fn()} as unknown as Editor;return {editor,setComposing:(value:boolean)=>{composing=value;}};}
const getRevision=()=>1,getDirty=()=>false;
afterEach(()=>jest.useRealTimers());
it('Expo bridgeがcallback proxyを作り直してもreadyと初期選択を再送しない',async()=>{
 const f=fixture(),first=callbacks();const {rerender}=await renderHook(({events}:{events:ReturnType<typeof callbacks>})=>useDOMNoteBridge({editor:f.editor,sessionId:1,disabled:false,getRevision,getDirty,events}),{initialProps:{events:first}});
 expect(first.onReady).toHaveBeenCalledTimes(1);expect(first.onStateChange).toHaveBeenCalledTimes(1);
 const second=callbacks();await rerender({events:second});expect(second.onReady).not.toHaveBeenCalled();expect(second.onStateChange).not.toHaveBeenCalled();expect(f.editor.off).not.toHaveBeenCalled();
});
it('proxy更新中もIME確定待ちの要求を保持し、最新callbackへ返信する',async()=>{
 jest.useFakeTimers();const f=fixture(),first=callbacks();const {result,rerender}=await renderHook(({events}:{events:ReturnType<typeof callbacks>})=>useDOMNoteBridge({editor:f.editor,sessionId:1,disabled:false,getRevision,getDirty,events}),{initialProps:{events:first}});
 await act(async()=>{f.setComposing(true);result.current.requestSnapshot(7);});const second=callbacks();await rerender({events:second});
 await act(async()=>{f.setComposing(false);result.current.compositionEnd();jest.runOnlyPendingTimers();});
 expect(first.onSnapshot).not.toHaveBeenCalled();expect(second.onSnapshot).toHaveBeenCalledWith({sessionId:1,requestId:7,revision:1,document:eventNoteFromPlainText('最後の文字')});
});
