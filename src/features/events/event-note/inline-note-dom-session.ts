import type {EventNoteDocumentV1} from '@/domain/calendar/event-note';
type Port=Readonly<{
  composing():boolean; blur():void; setEditable(value:boolean):void;
  read():{revision:number;document:EventNoteDocumentV1};
  respond(requestId:number,revision:number,document:EventNoteDocumentV1):void;
  fail(requestId:number):void;
}>;
/** IME確定前に編集可否を切り替えると最後の文字を失うため、確定イベントを待つ。 */
export class InlineNoteDOMSession {
  private requestId:number|null=null;
  private disabled=false;
  private completed=false;
  private timer:ReturnType<typeof setTimeout>|undefined;
  constructor(private port:Port){}
  request(id:number){
    if(this.requestId!==null)return;
    this.requestId=id;this.completed=false;
    if(this.port.composing())this.port.blur();else this.complete(id);
  }
  private complete(id:number){
    if(this.requestId!==id||this.completed)return;
    if(this.port.composing()){this.timer=setTimeout(()=>this.complete(id),16);return;}
    this.completed=true;this.port.setEditable(false);
    try{const result=this.port.read();this.port.respond(id,result.revision,result.document);}catch{this.port.fail(id);}
  }
  compositionEnd(){const id=this.requestId;if(id!==null)this.timer=setTimeout(()=>this.complete(id),0);else this.setDisabled(this.disabled);}
  setDisabled(value:boolean){this.disabled=value;if(!this.port.composing())this.port.setEditable(!value&&this.requestId===null);}
  release(id:number){if(this.requestId!==id)return;clearTimeout(this.timer);this.requestId=null;this.completed=false;this.setDisabled(this.disabled);}
  dispose(){clearTimeout(this.timer);this.disabled=true;this.requestId=null;}
}
