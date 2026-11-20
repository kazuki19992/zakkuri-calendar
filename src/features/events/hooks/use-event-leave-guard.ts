import {useEffect} from 'react';
import {BackHandler,Keyboard} from 'react-native';
import {usePreventRemove} from 'expo-router/react-navigation';
type State=Readonly<{isBusy:boolean;canLeave?():boolean;confirmLeave():Promise<boolean>;noteSession:{blur():void}}>;
/** ヘッダー・gesture・Androidの戻るを同じ最新本文確認へ集約する。 */
export function useEventLeaveGuard(state:State){
  usePreventRemove(true,({repeat})=>{
    if(state.canLeave?.()){repeat();return;}
    if(state.isBusy)return;
    void state.confirmLeave().then(allowed=>{if(allowed)repeat();});
  });
  useEffect(()=>{
    const subscription=BackHandler.addEventListener('hardwareBackPress',()=>{
      if(state.isBusy)return true;
      if(Keyboard.isVisible()){state.noteSession.blur();Keyboard.dismiss();return true;}
      return false;
    });
    return ()=>subscription.remove();
  },[state]);
}
