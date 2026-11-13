import {act,renderHook,waitFor} from '@testing-library/react-native';
import {useTemporalDefinitionSettings} from '../use-temporal-definition-settings';
import {createStandardTemporalDefinitions} from '@/domain/temporal/standard-definitions';
import type {TemporalDefinitionRepository} from '@/domain/calendar/repositories';
const definition = createStandardTemporalDefinitions('personal-default','2026-11-13')[0];
function setup() {
  const repository: jest.Mocked<TemporalDefinitionRepository> = { getById:jest.fn().mockResolvedValue(definition),listEnabled:jest.fn(),listEditable:jest.fn(),disable:jest.fn(),previewUpdate:jest.fn(),updateDefinition:jest.fn().mockResolvedValue(undefined) };
  repository.previewUpdate.mockImplementation(async (_id, patch) => ({definition,next:{...definition,...patch},count:3,token:'token'}));
  return {repository,onSaved:jest.fn()};
}
it('draftと初期値復元は保存までDBを書き換えず、確認後だけ保存する',async()=>{
  const input=setup(); const {result}=await renderHook(()=>useTemporalDefinitionSettings({...input,id:definition.id}));
  await waitFor(()=>expect(result.current.status).toBe('ready'));
  await act(async()=>result.current.edit({fadeInRatio:.35}));
  expect(input.repository.updateDefinition).not.toHaveBeenCalled();
  expect(result.current.dirty).toBe(true);
  await act(async()=>{ await result.current.prepareSave(); });
  expect(result.current.preview?.count).toBe(3);
  await act(async()=>{ expect(await result.current.confirmSave()).toBe(true); });
  expect(input.repository.updateDefinition).toHaveBeenCalledWith(expect.objectContaining({token:'token',patch:{fadeInRatio:.35}}));
  expect(input.onSaved).toHaveBeenCalledTimes(1);
});
it('保存失敗後もdraftを維持し、初期値復元も保存まで反映しない',async()=>{
  const input=setup(); input.repository.updateDefinition.mockRejectedValue(new Error('test'));
  const {result}=await renderHook(()=>useTemporalDefinitionSettings({...input,id:definition.id}));
  await waitFor(()=>expect(result.current.status).toBe('ready'));
  await act(async()=>result.current.edit({fadeInRatio:.4}));
  await act(async()=>{ await result.current.prepareSave(); });
  await act(async()=>{ expect(await result.current.confirmSave()).toBe(false); });
  expect(result.current.draft?.fadeInRatio).toBe(.4);
  expect(result.current.error).toBeTruthy();
  await act(async()=>result.current.restore());
  expect(result.current.draft?.fadeInRatio).toBe(.25);
  expect(input.onSaved).not.toHaveBeenCalled();
});
it('連打を同期的に抑止し、画面離脱後は成功として返さない',async()=>{
  const input=setup(); let complete!:()=>void;
  input.repository.updateDefinition.mockImplementation(()=>new Promise(resolve=>{complete=resolve;}));
  const {result,unmount}=await renderHook(()=>useTemporalDefinitionSettings({...input,id:definition.id}));
  await waitFor(()=>expect(result.current.status).toBe('ready'));
  await act(async()=>result.current.edit({fadeInRatio:.4}));
  await act(async()=>{await result.current.prepareSave();});
  let first!:Promise<boolean>;
  await act(async()=>{first=result.current.confirmSave();expect(await result.current.confirmSave()).toBe(false);});
  await unmount(); complete();
  expect(await first).toBe(false);
  expect(input.repository.updateDefinition).toHaveBeenCalledTimes(1);
});
it('確認中に定義が更新されても勝手に保存せずdraftを引き継いで再確認する',async()=>{
  const input=setup();const latest={...definition,fadeOutRatio:.1};
  input.repository.previewUpdate.mockImplementation(async(_id,patch)=>({definition:latest,next:{...latest,...patch},count:1,token:'new'}));
  const {result}=await renderHook(()=>useTemporalDefinitionSettings({...input,id:definition.id}));
  await waitFor(()=>expect(result.current.status).toBe('ready'));
  await act(async()=>result.current.edit({fadeInRatio:.4}));
  await act(async()=>{expect(await result.current.prepareSave()).toBe(false);});
  expect(result.current.preview).toBeNull();expect(result.current.error).toContain('再確認');
  expect(result.current.draft).toMatchObject({fadeInRatio:.4,fadeOutRatio:.1});
  expect(input.repository.updateDefinition).not.toHaveBeenCalled();
});
it('不正な範囲では保存確認を呼び出さず、読み込み失敗は初期値で埋めない',async()=>{
  const input=setup();const {result}=await renderHook(()=>useTemporalDefinitionSettings({...input,id:definition.id}));
  await waitFor(()=>expect(result.current.status).toBe('ready'));
  await act(async()=>result.current.edit({resolverConfig:{kind:'timeOfDay',startMinute:600,endMinute:500}}));
  await act(async()=>{expect(await result.current.prepareSave()).toBe(false);});
  expect(input.repository.previewUpdate).not.toHaveBeenCalled();
  input.repository.getById.mockRejectedValue(new Error('test'));
  await act(async()=>result.current.reload());
  await waitFor(()=>expect(result.current.status).toBe('error'));
  expect(result.current.draft).toBeNull();
});
it('保存中に対象が切り替わっても新しい画面を保存中のままにしない',async()=>{
  const input=setup();let complete!:()=>void;
  input.repository.updateDefinition.mockImplementation(()=>new Promise(resolve=>{complete=resolve;}));
  input.repository.getById.mockImplementation(async id=>({...definition,id}));
  const {result,rerender}=await renderHook(({id}:{id:string})=>useTemporalDefinitionSettings({...input,id}),{initialProps:{id:definition.id}});
  await waitFor(()=>expect(result.current.status).toBe('ready'));
  await act(async()=>result.current.edit({fadeInRatio:.4}));
  await act(async()=>{await result.current.prepareSave();});
  let saving!:Promise<boolean>;await act(async()=>{saving=result.current.confirmSave();});
  await rerender({id:'other'});await waitFor(()=>expect(result.current.draft?.id).toBe('other'));
  expect(result.current.isSaving).toBe(false);
  complete();expect(await saving).toBe(false);
});
