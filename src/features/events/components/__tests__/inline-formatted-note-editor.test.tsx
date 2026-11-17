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
