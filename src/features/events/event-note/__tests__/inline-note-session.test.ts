import {eventNoteFromPlainText} from '@/domain/calendar/event-note';
import {InlineNoteSession} from '../inline-note-session';
const original=eventNoteFromPlainText('元');
const latest=eventNoteFromPlainText('最新の一文字');
function fixture(){const session=new InlineNoteSession(original);const transport={request:jest.fn(),release:jest.fn(),blur:jest.fn()};session.attach(transport);session.ready(1);return {session,transport};}
afterEach(()=>jest.useRealTimers());
it('dirty通知前でも要求し、最新本文の応答まで待つ',async()=>{
 const {session,transport}=fixture();const result=session.capture();const other=session.capture();
 expect(transport.request).toHaveBeenCalledTimes(1);expect(session.getSnapshot().pending).toBe(true);
 session.receive({sessionId:1,requestId:1,revision:1,document:latest});
 expect(await result).toEqual(latest);expect(await other).toEqual(latest);expect(session.getSnapshot().document).toEqual(latest);
 session.release();expect(transport.release).toHaveBeenCalledWith(1);
});
it('古いrevisionや別sessionの通知で新しい文書を戻さない',()=>{
 const {session}=fixture();session.change({sessionId:1,revision:2,document:latest});
 session.change({sessionId:1,revision:1,document:original});session.change({sessionId:0,revision:3,document:original});
 expect(session.getSnapshot().document).toEqual(latest);
});
it('不正文書は保持済み文書を上書きせず要求を失敗させる',async()=>{
 const {session}=fixture();const result=session.capture();const rejected=expect(result).rejects.toThrow();
 session.receive({sessionId:1,requestId:1,revision:1,document:{version:99}});
 await rejected;expect(session.getSnapshot().document).toEqual(original);
});
it('未準備で入力できない間は元文書で保存でき、編集開始後のfatalは拒否する',async()=>{
 const session=new InlineNoteSession(original);session.fail(1,'load');expect(await session.capture()).toEqual(original);
 session.ready(1);session.fail(1,'load');await expect(session.capture()).rejects.toThrow();
 expect(session.getSnapshot().document).toEqual(original);
});
it('timeout後の遅延応答を次の要求と混ぜない',async()=>{
 jest.useFakeTimers();const {session,transport}=fixture();const result=session.capture();const rejected=expect(result).rejects.toThrow();
 jest.advanceTimersByTime(5000);await rejected;expect(transport.release).toHaveBeenCalledWith(1);
 const next=session.capture();session.receive({sessionId:1,requestId:1,revision:1,document:original});expect(session.getSnapshot().pending).toBe(true);
 session.receive({sessionId:1,requestId:2,revision:2,document:latest});expect(await next).toEqual(latest);session.release();
});
it('再初期化は最後の検証済み文書を使い旧session応答を捨てる',()=>{
 const {session}=fixture();session.change({sessionId:1,revision:1,document:latest});session.restart();
 expect(session.getSnapshot()).toMatchObject({sessionId:2,seed:latest,document:latest,ready:false});
 session.change({sessionId:1,revision:99,document:original});expect(session.getSnapshot().document).toEqual(latest);
});
it('破棄は待機要求を終了し、離脱後の応答で更新しない',async()=>{
 const {session}=fixture();const promise=session.capture();const rejected=expect(promise).rejects.toThrow();session.dispose();await rejected;
 session.receive({sessionId:1,requestId:1,revision:1,document:latest});expect(session.getSnapshot().document).toEqual(original);
});
it('空への変更をnullへ正規化し、不正文書通知では元文書を保持する',()=>{
 const {session}=fixture();session.change({sessionId:1,revision:1,document:{version:1,blocks:[]}});expect(session.getSnapshot().document).toBeNull();
 session.change({sessionId:1,revision:2,document:{version:99}});expect(session.getSnapshot().document).toBeNull();
});
