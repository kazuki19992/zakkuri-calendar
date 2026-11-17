import {eventNoteFromPlainText} from '@/domain/calendar/event-note';
import {InlineNoteDOMSession} from '../inline-note-dom-session';
function fixture(){let composing=false;let text='入力前';const responses:unknown[]=[];const editable=jest.fn();const failure=jest.fn();const blur=jest.fn();
 const session=new InlineNoteDOMSession({composing:()=>composing,blur,setEditable:editable,read:()=>({revision:1,document:eventNoteFromPlainText(text)!}),respond:(...args)=>responses.push(args),fail:failure});
 return {session,responses,editable,failure,blur,setComposing:(value:boolean)=>{composing=value;},setText:(value:string)=>{text=value;}};
}
afterEach(()=>jest.useRealTimers());
it('要求時点の最新文書を取得しreleaseまで入力を固定する',()=>{const f=fixture();f.setText('最後の文字');f.session.request(1);expect(f.responses).toEqual([[1,1,eventNoteFromPlainText('最後の文字')]]);expect(f.editable).toHaveBeenLastCalledWith(false);f.session.release(9);expect(f.editable).toHaveBeenLastCalledWith(false);f.session.release(1);expect(f.editable).toHaveBeenLastCalledWith(true);});
it('IME変換中は確定イベント後の本文を待つ',()=>{jest.useFakeTimers();const f=fixture();f.setComposing(true);f.session.request(1);expect(f.blur).toHaveBeenCalledTimes(1);expect(f.responses).toEqual([]);f.setText('確定後');f.setComposing(false);f.session.compositionEnd();jest.runOnlyPendingTimers();expect(f.responses).toEqual([[1,1,eventNoteFromPlainText('確定後')]]);});
it('timeout解除後のcomposition終了は次の要求へ混ぜない',()=>{jest.useFakeTimers();const f=fixture();f.setComposing(true);f.session.request(1);f.session.release(1);f.setComposing(false);f.session.compositionEnd();jest.runOnlyPendingTimers();expect(f.responses).toEqual([]);f.session.request(2);expect(f.responses).toHaveLength(1);expect(f.responses[0]).toEqual([2,1,eventNoteFromPlainText('入力前')]);});
it('変換失敗を空文書として返信しない',()=>{const failure=jest.fn(),respond=jest.fn();const session=new InlineNoteDOMSession({composing:()=>false,blur:jest.fn(),setEditable:jest.fn(),read:()=>{throw new Error('変換不能');},respond,fail:failure});session.request(1);expect(respond).not.toHaveBeenCalled();expect(failure).toHaveBeenCalledWith(1);});
it('範囲選択中にreleaseされても外側のdisabledを優先する',()=>{const f=fixture();f.session.setDisabled(true);f.session.request(1);f.session.release(1);expect(f.editable).toHaveBeenLastCalledWith(false);f.session.setDisabled(false);expect(f.editable).toHaveBeenLastCalledWith(true);});
