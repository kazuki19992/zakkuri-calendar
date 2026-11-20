import {Alert} from 'react-native';
import {usePreventRemove} from 'expo-router/react-navigation';
/** ヘッダー・システムの戻る操作を同じ破棄確認へ集約する。 */
export function useSettingsLeaveGuard(dirty:boolean,isSaving:boolean){
  usePreventRemove(dirty||isSaving,({repeat})=>{
    if(isSaving)return;
    Alert.alert('変更を破棄しますか？','保存していない変更があります。',[
      {text:'編集を続ける',style:'cancel'},
      {text:'破棄して戻る',style:'destructive',onPress:()=>repeat()},
    ]);
  });
}
