import {renderHook,act} from '@testing-library/react-native';
import {useNavigation} from 'expo-router';
import {usePreventRemove} from 'expo-router/react-navigation';
import {useEventLeaveGuard} from '../use-event-leave-guard';
jest.mock('expo-router',()=>({useNavigation:jest.fn()}));
jest.mock('expo-router/react-navigation',()=>({usePreventRemove:jest.fn()}));
it('保存中は戻らず、最新本文の破棄確認が成功した時だけ元の操作を再開する',async()=>{
 const dispatch=jest.fn();jest.mocked(useNavigation).mockReturnValue({dispatch} as unknown as ReturnType<typeof useNavigation>);
 const confirmLeave=jest.fn().mockResolvedValue(false);const noteSession={blur:jest.fn()};
 const {rerender}=await renderHook(({isBusy}:{isBusy:boolean})=>useEventLeaveGuard({isBusy,confirmLeave,noteSession}),{initialProps:{isBusy:false}});
 const action={type:'GO_BACK'};await act(async()=>{jest.mocked(usePreventRemove).mock.calls.at(-1)![1]({data:{action}});});expect(dispatch).not.toHaveBeenCalled();
 confirmLeave.mockResolvedValue(true);await act(async()=>{jest.mocked(usePreventRemove).mock.calls.at(-1)![1]({data:{action}});});expect(dispatch).toHaveBeenCalledWith(action);
 confirmLeave.mockClear();await rerender({isBusy:true});await act(async()=>{jest.mocked(usePreventRemove).mock.calls.at(-1)![1]({data:{action}});});expect(confirmLeave).not.toHaveBeenCalled();
});
it('保存・削除成功後は文書の確認を繰り返さず戻れる',async()=>{
 const dispatch=jest.fn();jest.mocked(useNavigation).mockReturnValue({dispatch} as unknown as ReturnType<typeof useNavigation>);
 const confirmLeave=jest.fn().mockResolvedValue(false);
 await renderHook(()=>useEventLeaveGuard({isBusy:false,canLeave:()=>true,confirmLeave,noteSession:{blur:jest.fn()}}));
 const action={type:'GO_BACK'};await act(async()=>{jest.mocked(usePreventRemove).mock.calls.at(-1)![1]({data:{action}});});
 expect(dispatch).toHaveBeenCalledWith(action);expect(confirmLeave).not.toHaveBeenCalled();
});
