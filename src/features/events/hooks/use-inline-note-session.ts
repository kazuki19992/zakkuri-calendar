import {useEffect,useState,useSyncExternalStore} from 'react';
import {InlineNoteSession} from '../event-note/inline-note-session';
export function useInlineNoteSession(){
  const [session]=useState(()=>new InlineNoteSession());
  const snapshot=useSyncExternalStore(session.subscribe,session.getSnapshot,session.getSnapshot);
  useEffect(()=>{session.activate();return ()=>session.dispose();},[session]);
  return {session,snapshot};
}
