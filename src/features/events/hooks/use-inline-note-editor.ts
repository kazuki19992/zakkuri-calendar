import {useCallback,useEffect,useMemo,useRef,useState,useSyncExternalStore,type ComponentRef} from 'react';
import {Alert,Keyboard,ScrollView,View,useWindowDimensions,type KeyboardEvent,type LayoutChangeEvent,type NativeSyntheticEvent,type NativeScrollEvent} from 'react-native';
import {useReduceMotion} from '@/hooks/use-reduce-motion';
import {computeInlineNoteHeight} from '../event-note/inline-note-layout';
import type {InlineNoteSession,NoteUpdate,NoteResponse} from '../event-note/inline-note-session';
import type {EditorSelectionState,FormattedNoteEditorDOMRef} from '../components/formatted-note-editor/formatted-note-editor.dom';
const EMPTY_SELECTION:EditorSelectionState={bold:false,italic:false,bulletList:false,orderedList:false,taskList:false,linkUrl:null,dirty:false};

/** WebViewとフォームの寸法・focus・toolbarを調整し、画面からOS APIを分離する。 */
export function useInlineNoteEditor(session:InlineNoteSession,disabled:boolean){
  const snapshot=useSyncExternalStore(session.subscribe,session.getSnapshot,session.getSnapshot);
  // Expo DOMのプロキシはマウントしたWebViewに結び付くので、再試行時は新しいrefを渡す。
  const editorRef = useMemo(() => ({
    sessionId: snapshot.sessionId,
    current: null as FormattedNoteEditorDOMRef | null,
  }), [snapshot.sessionId]);
  const rootRef=useRef<ComponentRef<typeof View>>(null);
  const fieldRef=useRef<ComponentRef<typeof View>>(null);
  const scrollRef=useRef<ComponentRef<typeof ScrollView>>(null);
  const window=useWindowDimensions(),reduceMotion=useReduceMotion();
  const [frame,setFrame]=useState({y:0,height:window.height});
  const [keyboardTop,setKeyboardTop]=useState<number|null>(()=>Keyboard.metrics?.()?.screenY??null);
  const [contentHeight,setContentHeight]=useState(120);
  const [toolbarHeight, setToolbarHeight] = useState(52);
  const onToolbarLayout = useCallback((event: LayoutChangeEvent) => {
    setToolbarHeight(event.nativeEvent.layout.height);
  }, []);
  const [focusState,setFocus]=useState({sessionId:snapshot.sessionId,value:false});
  const focused=focusState.sessionId===snapshot.sessionId&&focusState.value&&snapshot.ready;
  const setFocused=useCallback((value:boolean)=>setFocus({sessionId:snapshot.sessionId,value}),[snapshot.sessionId]);
  const [selection,setSelection]=useState(EMPTY_SELECTION);
  const toolbarHolding=useRef(false),scrollY=useRef(0);
  const deferredBlur=useRef(false);
  const editorFocused=useRef(false);
  const blurTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const sessionId=snapshot.sessionId;
  const current=useCallback(()=>session.getSnapshot().sessionId===sessionId,[session,sessionId]);
  useEffect(()=>session.attach({
    request: (id) => {
      if (editorRef.sessionId !== session.getSnapshot().sessionId || typeof editorRef.current?.requestSnapshot !== 'function') {
        throw new Error('Editor unavailable');
      }
      editorRef.current.requestSnapshot(id);
    },
    release:id=>editorRef.current?.releaseSnapshot?.(id),blur:()=>editorRef.current?.blur?.(),
  }),[editorRef,session]);
  const endEditing = useCallback(() => {
    clearTimeout(blurTimer.current);
    deferredBlur.current = false;
    toolbarHolding.current = false;
    setFocused(false);
    if (editorFocused.current) {
      editorFocused.current = false;
      session.blur();
    }
  }, [session, setFocused]);
  useEffect(() => {
    const updateFrame = (event: KeyboardEvent) => {
      setKeyboardTop(event.endCoordinates.height > 0 ? event.endCoordinates.screenY : null);
    };
    const animateFrame = (event: KeyboardEvent) => {
      if (!reduceMotion) Keyboard.scheduleLayoutAnimation(event);
      updateFrame(event);
    };
    const show = Keyboard.addListener('keyboardDidShow', updateFrame);
    const willShow = Keyboard.addListener('keyboardWillShow', animateFrame);
    const change = Keyboard.addListener('keyboardWillChangeFrame', animateFrame);
    const willHide = Keyboard.addListener('keyboardWillHide', (event) => {
      if (!reduceMotion) Keyboard.scheduleLayoutAnimation(event);
      setKeyboardTop(null);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardTop(null);
      endEditing();
    });
    return () => {
      show.remove();
      willShow.remove();
      change.remove();
      willHide.remove();
      hide.remove();
    };
  }, [endEditing, reduceMotion]);
  useEffect(() => () => clearTimeout(blurTimer.current), []);
  const onRootLayout=useCallback(()=>{
    rootRef.current?.measureInWindow((_x,y,_width,height)=>setFrame(previous=>previous.y===y&&previous.height===height?previous:{y,height}));
  },[]);
  // OSがすでに画面を縮めた場合は、実際に重なる分だけを余白にする。
  const keyboardInset = keyboardTop === null ? 0 : Math.min(frame.height, Math.max(0, frame.y + frame.height - keyboardTop));
  const available=Math.max(0,frame.height-keyboardInset-52-toolbarHeight-24);
  const height=computeInlineNoteHeight(contentHeight,available);
  useEffect(()=>{
    if(!focused)return;
    const timer=setTimeout(()=>fieldRef.current?.measureInWindow((_x,y)=>{
      const top=frame.y+52+8;
      const offset=Math.max(0,scrollY.current+y-top);
      scrollRef.current?.scrollTo({y:offset,animated:!reduceMotion});
    }),0);
    return ()=>clearTimeout(timer);
  },[focused,keyboardTop,frame,reduceMotion,height,toolbarHeight]);
  const onFocusChange=useCallback(async(value:boolean)=>{
    if(!current())return;
    clearTimeout(blurTimer.current);
    deferredBlur.current=false;
    editorFocused.current=value;
    if(value){session.markEditingStarted();setFocused(true);}
    else blurTimer.current=setTimeout(()=>{
      if(!current())return;
      if(toolbarHolding.current)deferredBlur.current=true;
      else setFocused(false);
    },150);
  },[current,session,setFocused]);
  const onToolbarTouchEnd=useCallback(()=>{
    toolbarHolding.current=false;
    if(current()&&deferredBlur.current){deferredBlur.current=false;setFocused(false);}
  },[current,setFocused]);
  const retry=useCallback(()=>{
    if(disabled||session.getSnapshot().pending)return;
    if(snapshot.ready&&snapshot.error!=='timeout'){void session.capture().catch(()=>{}).finally(()=>session.release());return;}
    if(snapshot.everReady){
      Alert.alert('最後に取得できた内容から再読み込みしますか？','取得できていない文字は失われる可能性があります。',[
        {text:'編集を続ける',style:'cancel'},
        {text:'再読み込み',onPress:()=>session.restart()},
      ]);
    }else session.restart();
  },[disabled,session,snapshot]);
  return {session,snapshot,
    editorRef,
    bindRoot:useCallback((value:ComponentRef<typeof View>|null)=>{rootRef.current=value;},[]),
    bindField:useCallback((value:ComponentRef<typeof View>|null)=>{fieldRef.current=value;},[]),
    bindScroll:useCallback((value:ComponentRef<typeof ScrollView>|null)=>{scrollRef.current=value;},[]),
    onToolbarTouchStart:useCallback(()=>{toolbarHolding.current=true;},[]),
    onToolbarTouchEnd,
    toggleBold:useCallback(()=>editorRef.current?.toggleBold?.(),[editorRef]),
    toggleItalic:useCallback(()=>editorRef.current?.toggleItalic?.(),[editorRef]),
    toggleBulletList:useCallback(()=>editorRef.current?.toggleBulletList?.(),[editorRef]),
    toggleOrderedList:useCallback(()=>editorRef.current?.toggleOrderedList?.(),[editorRef]),
    toggleTaskList:useCallback(()=>editorRef.current?.toggleTaskList?.(),[editorRef]),
    onRootLayout,onToolbarLayout,keyboardInset,height,fontScale:window.fontScale,focused,selection,endEditing,retry,
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
