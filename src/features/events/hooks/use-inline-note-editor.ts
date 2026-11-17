import {useCallback,useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {Alert,Keyboard,ScrollView,View,useWindowDimensions,type NativeSyntheticEvent,type NativeScrollEvent} from 'react-native';
import {useReduceMotion} from '@/hooks/use-reduce-motion';
import {computeInlineNoteHeight} from '../event-note/inline-note-layout';
import type {InlineNoteSession,NoteUpdate,NoteResponse} from '../event-note/inline-note-session';
import type {EditorSelectionState,FormattedNoteEditorDOMRef} from '../components/formatted-note-editor/formatted-note-editor.dom';
const EMPTY_SELECTION:EditorSelectionState={bold:false,italic:false,bulletList:false,orderedList:false,taskList:false,linkUrl:null,dirty:false};

/** WebViewとフォームの寸法・focus・toolbarを調整し、画面からOS APIを分離する。 */
export function useInlineNoteEditor(session:InlineNoteSession,disabled:boolean){
  const snapshot=useSyncExternalStore(session.subscribe,session.getSnapshot,session.getSnapshot);
  const editorRef=useRef<FormattedNoteEditorDOMRef>(null);
  const rootRef=useRef<View>(null),fieldRef=useRef<View>(null),scrollRef=useRef<ScrollView>(null);
  const window=useWindowDimensions(),reduceMotion=useReduceMotion();
  const [frame,setFrame]=useState({y:0,height:window.height});
  const [keyboardTop,setKeyboardTop]=useState<number|null>(null);
  const [contentHeight,setContentHeight]=useState(120);
  const [focusState,setFocus]=useState({sessionId:snapshot.sessionId,value:false});
  const focused=focusState.sessionId===snapshot.sessionId&&focusState.value&&snapshot.ready;
  const setFocused=useCallback((value:boolean)=>setFocus({sessionId:snapshot.sessionId,value}),[snapshot.sessionId]);
  const [selection,setSelection]=useState(EMPTY_SELECTION);
  const toolbarHolding=useRef(false),scrollY=useRef(0);
  const blurTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const sessionId=snapshot.sessionId;
  const current=useCallback(()=>session.getSnapshot().sessionId===sessionId,[session,sessionId]);
  useEffect(()=>session.attach({
    request:id=>{if(!editorRef.current)throw new Error('Editor unavailable');editorRef.current.requestSnapshot(id);},
    release:id=>editorRef.current?.releaseSnapshot(id),blur:()=>editorRef.current?.blur(),
  }),[session]);
  useEffect(()=>{
    const show=Keyboard.addListener('keyboardDidShow',event=>setKeyboardTop(event.endCoordinates.screenY));
    const hide=Keyboard.addListener('keyboardDidHide',()=>setKeyboardTop(null));
    const change=Keyboard.addListener('keyboardWillChangeFrame',event=>setKeyboardTop(event.endCoordinates.height>0?event.endCoordinates.screenY:null));
    return ()=>{show.remove();hide.remove();change.remove();clearTimeout(blurTimer.current);};
  },[]);
  const onRootLayout=useCallback(()=>{
    rootRef.current?.measureInWindow((_x,y,_width,height)=>setFrame(previous=>previous.y===y&&previous.height===height?previous:{y,height}));
  },[]);
  const available=Math.max(0,Math.min(frame.height,keyboardTop===null?frame.height:keyboardTop-frame.y)-52-(focused?60:0)-24);
  const height=computeInlineNoteHeight(contentHeight,available);
  useEffect(()=>{
    if(!focused)return;
    const timer=setTimeout(()=>fieldRef.current?.measureInWindow((_x,y)=>{
      const top=frame.y+52+8;
      const offset=Math.max(0,scrollY.current+y-top);
      scrollRef.current?.scrollTo({y:offset,animated:!reduceMotion});
    }),0);
    return ()=>clearTimeout(timer);
  },[focused,keyboardTop,frame,reduceMotion,height]);
  const endEditing=useCallback(()=>{clearTimeout(blurTimer.current);setFocused(false);session.blur();},[session,setFocused]);
  const onFocusChange=useCallback(async(value:boolean)=>{
    if(!current())return;
    clearTimeout(blurTimer.current);
    if(value)setFocused(true);
    else blurTimer.current=setTimeout(()=>{if(!toolbarHolding.current)setFocused(false);},150);
  },[current,setFocused]);
  const retry=useCallback(()=>{
    if(disabled||session.getSnapshot().pending)return;
    if(snapshot.ready){void session.capture().catch(()=>{}).finally(()=>session.release());return;}
    if(snapshot.everReady){
      Alert.alert('最後に取得できた内容から再読み込みしますか？','取得できていない文字は失われる可能性があります。',[
        {text:'編集を続ける',style:'cancel'},
        {text:'再読み込み',onPress:()=>session.restart()},
      ]);
    }else session.restart();
  },[disabled,session,snapshot]);
  return {session,snapshot,
    bindEditor:useCallback((value:FormattedNoteEditorDOMRef|null)=>{editorRef.current=value;},[]),
    bindRoot:useCallback((value:View|null)=>{rootRef.current=value;},[]),
    bindField:useCallback((value:View|null)=>{fieldRef.current=value;},[]),
    bindScroll:useCallback((value:ScrollView|null)=>{scrollRef.current=value;},[]),
    onToolbarTouchStart:useCallback(()=>{toolbarHolding.current=true;},[]),
    onToolbarTouchEnd:useCallback(()=>{toolbarHolding.current=false;},[]),
    toggleBold:useCallback(()=>editorRef.current?.toggleBold(),[]),
    toggleItalic:useCallback(()=>editorRef.current?.toggleItalic(),[]),
    toggleBulletList:useCallback(()=>editorRef.current?.toggleBulletList(),[]),
    toggleOrderedList:useCallback(()=>editorRef.current?.toggleOrderedList(),[]),
    toggleTaskList:useCallback(()=>editorRef.current?.toggleTaskList(),[]),
    onRootLayout,height,fontScale:window.fontScale,focused,selection,endEditing,retry,
    disabled:disabled||snapshot.pending,
    onScroll:(event:NativeSyntheticEvent<NativeScrollEvent>)=>{scrollY.current=event.nativeEvent.contentOffset.y;},
    onReady:useCallback(async()=>{session.ready(sessionId);},[session,sessionId]),
    onFailure:useCallback(async()=>{if(current()){session.fail(sessionId,'load');setFocused(false);}},[session,sessionId,current,setFocused]),
    onConversionFailure:useCallback(async()=>session.fail(sessionId,'conversion'),[session,sessionId]),
    onSnapshotFailure:useCallback(async(requestId:number)=>session.fail(sessionId,'conversion',requestId),[session,sessionId]),
    onSnapshot:useCallback(async(response:NoteResponse)=>session.receive(response),[session]),
    onDocumentChange:useCallback(async(update:NoteUpdate)=>session.change(update),[session]),
    onFocusChange,
    onStateChange:useCallback(async(value:EditorSelectionState)=>{if(current())setSelection(value);},[current]),
    onContentHeight:useCallback(async(value:number)=>{if(current()&&Number.isFinite(value)&&value>0)setContentHeight(Math.ceil(value));},[current]),
  };
}
export type InlineNoteEditorModel=ReturnType<typeof useInlineNoteEditor>;
