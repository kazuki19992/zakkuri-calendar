import {normalizeEventNoteDocument, parseEventNoteDocument, type EventNoteDocumentV1} from '@/domain/calendar/event-note';
export type NoteDocument = EventNoteDocumentV1 | null;
export type NoteUpdate = Readonly<{sessionId:number; revision:number; document:unknown}>;
export type NoteResponse = NoteUpdate & Readonly<{requestId:number}>;
export type NoteTransport = Readonly<{request(id:number):void; release(id:number):void; blur():void}>;
export type NoteSessionSnapshot = Readonly<{
  sessionId:number; seed:NoteDocument; document:NoteDocument;
  ready:boolean; everReady:boolean; pending:boolean; error:'load'|'conversion'|'timeout'|null;
}>;
const failure=()=>new Error('メモの内容を確認できませんでした。');

/** DOMとの非同期通信を、予定保存より手前のインメモリ境界で検証する。 */
export class InlineNoteSession {
  private state:NoteSessionSnapshot;
  private listeners=new Set<()=>void>();
  private transport:NoteTransport|null=null;
  private revision=0;
  private sequence=0;
  private disposed=false;
  private heldRequest:number|null=null;
  private pending:{id:number;promise:Promise<NoteDocument>;resolve(value:NoteDocument):void;reject(error:Error):void;timer:ReturnType<typeof setTimeout>}|null=null;
  constructor(document:NoteDocument=null){
    this.state={sessionId:1,seed:document,document,ready:false,everReady:false,pending:false,error:null};
  }
  getSnapshot=():NoteSessionSnapshot=>this.state;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};};
  private publish(patch:Partial<NoteSessionSnapshot>){this.state={...this.state,...patch};this.listeners.forEach(listener=>listener());}
  attach(transport:NoteTransport){this.transport=transport;return ()=>{if(this.transport===transport)this.transport=null;};}
  activate(){if(this.disposed){this.disposed=false;this.restart();}}
  reset(document:NoteDocument){this.cancel();this.disposed=false;this.revision=0;this.publish({sessionId:this.state.sessionId+1,seed:document,document,ready:false,everReady:false,pending:false,error:null});}
  ready(sessionId:number){if(this.valid(sessionId))this.publish({ready:true,everReady:true,error:null});}
  private valid(sessionId:number){return !this.disposed&&sessionId===this.state.sessionId;}
  change(update:NoteUpdate){
    if(!this.valid(update.sessionId)||!Number.isSafeInteger(update.revision)||update.revision<=this.revision)return;
    const parsed=parseEventNoteDocument(update.document);
    if(!parsed.ok){this.publish({error:'conversion'});return;}
    this.revision=update.revision;
    this.publish({document:normalizeEventNoteDocument(parsed.value),error:null});
  }
  receive(response:NoteResponse){
    if(!this.valid(response.sessionId)||!this.pending||response.requestId!==this.pending.id)return;
    const parsed=parseEventNoteDocument(response.document);
    if(!parsed.ok||!Number.isSafeInteger(response.revision)||response.revision<this.revision){this.fail(response.sessionId,'conversion',response.requestId);return;}
    this.revision=response.revision;
    const document=normalizeEventNoteDocument(parsed.value),pending=this.pending;
    clearTimeout(pending.timer);this.pending=null;
    this.publish({document,pending:false,error:null});pending.resolve(document);
  }
  capture():Promise<NoteDocument>{
    if(this.disposed)return Promise.reject(failure());
    if(this.pending)return this.pending.promise;
    if(!this.state.ready)return this.state.everReady?Promise.reject(failure()):Promise.resolve(this.state.document);
    if(!this.transport)return Promise.reject(failure());
    const id=++this.sequence;
    let resolve!:(value:NoteDocument)=>void,reject!:(error:Error)=>void;
    const promise=new Promise<NoteDocument>((yes,no)=>{resolve=yes;reject=no;});
    const timer=setTimeout(()=>this.fail(this.state.sessionId,'timeout',id),5000);
    this.pending={id,promise,resolve,reject,timer};this.heldRequest=id;this.publish({pending:true,error:null});
    try{this.transport.request(id);}catch{this.fail(this.state.sessionId,'load',id);}
    return promise;
  }
  fail(sessionId:number,kind:'load'|'conversion'|'timeout',requestId?:number){
    if(!this.valid(sessionId)||(requestId!==undefined&&requestId!==this.pending?.id))return;
    const pending=this.pending;this.pending=null;
    if(pending)clearTimeout(pending.timer);
    this.release();this.publish({pending:false,error:kind,...(kind==='load'?{ready:false}:{})});
    pending?.reject(failure());
  }
  release(){if(this.heldRequest!==null){this.transport?.release(this.heldRequest);this.heldRequest=null;}}
  blur(){this.transport?.blur();}
  restart(){this.cancel();this.revision=0;this.publish({sessionId:this.state.sessionId+1,seed:this.state.document,ready:false,everReady:false,pending:false,error:null});}
  private cancel(){const pending=this.pending;this.pending=null;if(pending){clearTimeout(pending.timer);pending.reject(failure());}this.release();}
  dispose(){this.disposed=true;this.cancel();this.publish({pending:false});}
}
