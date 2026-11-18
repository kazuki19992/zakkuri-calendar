import React from 'react';
import {Alert,View} from 'react-native';
import {render,act,fireEvent} from '@testing-library/react-native';
import {InlineNoteSession} from '../../event-note/inline-note-session';
import {eventNoteFromPlainText} from '@/domain/calendar/event-note';
import {useInlineNoteEditor} from '../../hooks/use-inline-note-editor';
import {InlineFormattedNoteEditor,InlineNoteToolbar} from '../formatted-note-editor/inline-formatted-note-editor';
jest.mock('@/global.css',()=>({}));
let mockProps:any;
let mockMounts=0;
const mockCommands={requestSnapshot:jest.fn(),releaseSnapshot:jest.fn(),blur:jest.fn(),toggleBold:jest.fn(),toggleItalic:jest.fn(),toggleBulletList:jest.fn(),toggleOrderedList:jest.fn(),toggleTaskList:jest.fn()};
jest.mock('../formatted-note-editor/formatted-note-editor',()=>({FormattedNoteEditor:(props:any)=>{
 const R=jest.requireActual<typeof React>('react');const V=jest.requireActual<typeof import('react-native')>('react-native').View;
 mockProps=props;R.useImperativeHandle(props.editorRef,()=>mockCommands);R.useEffect(()=>{mockMounts++;},[]);return R.createElement(V,{testID:'inline-dom'});
}}));
function Harness({session,disabled=false}:{session:InlineNoteSession;disabled?:boolean}){const model=useInlineNoteEditor(session,disabled);return <View><InlineFormattedNoteEditor model={model} linkError={null}/><InlineNoteToolbar model={model} onOpenLink={jest.fn()}/></View>;}
beforeEach(()=>{jest.clearAllMocks();mockMounts=0;});
afterEach(()=>{jest.useRealTimers();jest.restoreAllMocks();});
it('本文を最初から埋め込み、メモ専用の完了は置かずreadyまでは入力を遮断する',async()=>{
 const session=new InlineNoteSession(eventNoteFromPlainText('本文'));
 const view=await render(<Harness session={session}/>);expect(view.getByTestId('inline-dom',{includeHiddenElements:true})).toBeTruthy();expect(view.queryByText('完了')).toBeNull();expect(mockProps.disabled).toBe(true);
 await act(async()=>mockProps.onReady());expect(mockProps.disabled).toBe(false);expect(view.queryByLabelText('太字')).toBeNull();
});
it('focus中だけtoolbarを表示し、選択状態を反映してcommandを送る',async()=>{
 const view=await render(<Harness session={new InlineNoteSession()}/>);
 await act(async()=>{await mockProps.onReady();await mockProps.onFocusChange(true);await mockProps.onStateChange({bold:true,italic:false,bulletList:false,orderedList:false,taskList:false,linkUrl:null,dirty:false});});
 expect(view.getByLabelText('太字').props.accessibilityState.selected).toBe(true);
 await fireEvent.press(view.getByLabelText('太字'));expect(mockCommands.toggleBold).toHaveBeenCalledTimes(1);
});
it('画面の再描画やdisabledの変更でDOMを再mountしない',async()=>{
 const session=new InlineNoteSession();const view=await render(<Harness session={session}/>);await act(async()=>mockProps.onReady());await view.rerender(<Harness session={session} disabled/>);expect(mockMounts).toBe(1);expect(mockProps.disabled).toBe(true);
});
it('初回準備失敗は元のメモを保持して再試行できる',async()=>{
 const session=new InlineNoteSession(eventNoteFromPlainText('元'));const view=await render(<Harness session={session}/>);await act(async()=>mockProps.onFailure());expect(view.getByText('元のメモのまま予定を保存できます。')).toBeTruthy();await fireEvent.press(view.getByLabelText('メモを再試行'));expect(mockMounts).toBe(2);expect(session.getSnapshot().document).toEqual(eventNoteFromPlainText('元'));
});
it('編集開始後のfatal再読込は確認し、最新の検証済み文書を使う',async()=>{
 const alert=jest.spyOn(Alert,'alert').mockImplementation(()=>{});const session=new InlineNoteSession();const view=await render(<Harness session={session}/>);
 await act(async()=>{await mockProps.onReady();await mockProps.onDocumentChange({sessionId:1,revision:1,document:eventNoteFromPlainText('最新')});await mockProps.onFailure();});
 await fireEvent.press(view.getByLabelText('メモを再試行'));expect(mockMounts).toBe(1);expect(alert).toHaveBeenCalled();
 await act(async()=>{alert.mock.calls[0][2]![1].onPress?.();});expect(mockProps.initialDocument).toEqual(eventNoteFromPlainText('最新'));expect(mockMounts).toBe(2);alert.mockRestore();
});
it('応答がないままタイムアウトした後は、確認してから最後の本文で再読み込みできる',async()=>{
 jest.useFakeTimers({doNotFake:['queueMicrotask']});const alert=jest.spyOn(Alert,'alert').mockImplementation(()=>{});
 const session=new InlineNoteSession();const view=await render(<Harness session={session}/>);
 const document=eventNoteFromPlainText('受信済みの本文');
 await act(async()=>{await mockProps.onReady();await mockProps.onDocumentChange({sessionId:1,revision:1,document});});
 let capture!:Promise<unknown>;
 await act(async()=>{capture=session.capture().catch(error=>error);});
 await act(async()=>jest.advanceTimersByTime(5000));await capture;
 await fireEvent.press(view.getByLabelText('メモを再試行'));
 expect(alert).toHaveBeenCalledTimes(1);expect(mockCommands.requestSnapshot).toHaveBeenCalledTimes(1);
 expect(mockMounts).toBe(1);expect(session.getSnapshot().document).toEqual(document);
 await act(async()=>alert.mock.calls[0][2]![1].onPress?.());
 expect(mockMounts).toBe(2);expect(mockProps.initialDocument).toEqual(document);
});
it('変換エラー後の再試行は再読み込みせず、同じDOMへ本文を再要求する',async()=>{
 const alert=jest.spyOn(Alert,'alert').mockImplementation(()=>{});const session=new InlineNoteSession();
 const view=await render(<Harness session={session}/>);
 await act(async()=>{await mockProps.onReady();await mockProps.onConversionFailure();});
 await fireEvent.press(view.getByLabelText('メモを再試行'));
 expect(alert).not.toHaveBeenCalled();expect(mockMounts).toBe(1);
 const requestId=mockCommands.requestSnapshot.mock.calls[0][0];
 await act(async()=>mockProps.onSnapshot({sessionId:1,requestId,revision:1,document:{version:1,blocks:[]}}));
 expect(session.getSnapshot()).toMatchObject({pending:false,error:null});
});
it.each(['touchEnd','touchCancel'])('長いツールバー操作の%sで、再focusがなければ保留したblurを反映する',async(event)=>{
 jest.useFakeTimers({doNotFake:['queueMicrotask']});const view=await render(<Harness session={new InlineNoteSession()}/>);
 await act(async()=>{await mockProps.onReady();await mockProps.onFocusChange(true);});
 await fireEvent(view.getByLabelText('太字'),'touchStart');
 await act(async()=>{await mockProps.onFocusChange(false);jest.advanceTimersByTime(200);});
 expect(view.getByLabelText('太字')).toBeTruthy();
 await fireEvent(view.getByLabelText('太字'),event);
 expect(view.queryByLabelText('太字')).toBeNull();
});
it.each(['touchEnd','touchCancel'])('長いツールバー操作でも再focus済みなら%sで閉じない',async(event)=>{
 jest.useFakeTimers({doNotFake:['queueMicrotask']});const view=await render(<Harness session={new InlineNoteSession()}/>);
 await act(async()=>{await mockProps.onReady();await mockProps.onFocusChange(true);});
 await fireEvent(view.getByLabelText('太字'),'touchStart');
 await act(async()=>{await mockProps.onFocusChange(false);jest.advanceTimersByTime(200);await mockProps.onFocusChange(true);});
 await fireEvent(view.getByLabelText('太字'),event);
 expect(view.getByLabelText('太字')).toBeTruthy();
});
it('短い書式タップはblurの猶予中に本文へ戻り、ツールバーを維持する',async()=>{
 jest.useFakeTimers({doNotFake:['queueMicrotask']});const view=await render(<Harness session={new InlineNoteSession()}/>);
 await act(async()=>{await mockProps.onReady();await mockProps.onFocusChange(true);});
 await fireEvent(view.getByLabelText('太字'),'touchStart');
 await act(async()=>{await mockProps.onFocusChange(false);jest.advanceTimersByTime(50);});
 await fireEvent(view.getByLabelText('太字'),'touchEnd');
 await fireEvent.press(view.getByLabelText('太字'));
 await act(async()=>{await mockProps.onFocusChange(true);jest.advanceTimersByTime(200);});
 expect(mockCommands.toggleBold).toHaveBeenCalledTimes(1);expect(view.getByLabelText('太字')).toBeTruthy();
});
