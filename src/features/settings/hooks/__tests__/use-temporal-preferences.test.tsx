import {act,renderHook,waitFor} from '@testing-library/react-native';
import {useTemporalPreferences} from '../use-temporal-preferences';
it('未定設定の失敗時は以前の値を保持し、不正な値は保存しない',async()=>{
  const settings={getUndeterminedFadeMinutes:jest.fn().mockResolvedValue(120),setUndeterminedFadeMinutes:jest.fn().mockRejectedValue(new Error('test'))};
  const input={settings,calendars:{getDefault:jest.fn().mockResolvedValue({id:'personal-default'})},definitions:{listEditable:jest.fn().mockResolvedValue([])},onSaved:jest.fn()};
  const {result}=await renderHook(()=>useTemporalPreferences(input));
  await act(async()=>{await result.current.reload();});await waitFor(()=>expect(result.current.status).toBe('ready'));
  await act(async()=>{expect(await result.current.saveMinutes(1441)).toBe(false);});
  expect(settings.setUndeterminedFadeMinutes).not.toHaveBeenCalled();
  await act(async()=>{expect(await result.current.saveMinutes(60)).toBe(false);});
  expect(result.current.minutes).toBe(120);expect(input.onSaved).not.toHaveBeenCalled();
  settings.setUndeterminedFadeMinutes.mockResolvedValue(undefined);
  await act(async()=>{expect(await result.current.saveMinutes(60)).toBe(true);});
  expect(result.current.minutes).toBe(60);expect(input.onSaved).toHaveBeenCalledTimes(1);
});
