import {renderHook,act} from '@testing-library/react-native';
import {Alert} from 'react-native';
import {useNavigation} from 'expo-router';
import {usePreventRemove} from 'expo-router/react-navigation';
import {useSettingsLeaveGuard} from '../use-settings-leave-guard';
jest.mock('expo-router',()=>({useNavigation:jest.fn()}));
jest.mock('expo-router/react-navigation',()=>({usePreventRemove:jest.fn()}));
it('未保存の戻る操作には破棄確認を出し、保存中は離脱させない',async()=>{
  const dispatch=jest.fn();jest.mocked(useNavigation).mockReturnValue({dispatch} as unknown as ReturnType<typeof useNavigation>);
  const alert=jest.spyOn(Alert,'alert').mockImplementation(()=>{});
  const {rerender}=await renderHook(({saving}:{saving:boolean})=>useSettingsLeaveGuard(true,saving),{initialProps:{saving:false}});
  const action={type:'GO_BACK'};
  await act(async()=>{jest.mocked(usePreventRemove).mock.calls.at(-1)![1]({data:{action}});});
  expect(alert).toHaveBeenCalled();expect(dispatch).not.toHaveBeenCalled();
  await act(async()=>{alert.mock.calls.at(-1)![2]![1].onPress!();});expect(dispatch).toHaveBeenCalledWith(action);
  alert.mockClear();await rerender({saving:true});
  await act(async()=>{jest.mocked(usePreventRemove).mock.calls.at(-1)![1]({data:{action}});});
  expect(alert).not.toHaveBeenCalled();alert.mockRestore();
});
