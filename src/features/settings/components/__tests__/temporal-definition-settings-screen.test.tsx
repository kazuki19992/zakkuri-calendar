import {render,fireEvent,waitFor} from '@testing-library/react-native';
import {TemporalDefinitionSettingsScreen} from '../../screens/temporal-definition-settings-screen';
import {useTemporalDefinitionSettings} from '../../hooks/use-temporal-definition-settings';
import {createStandardTemporalDefinitions} from '@/domain/temporal/standard-definitions';
import type {TemporalDefinitionRepository} from '@/domain/calendar/repositories';
jest.mock('@/global.css',()=>({}));
const definition=createStandardTemporalDefinitions('personal-default','2026-11-13')[0];
it('ぼかしを編集しても確認まで保存せず、読み上げ名と差分を示して確定する',async()=>{
  const repository:TemporalDefinitionRepository={listEditable:jest.fn(),listEnabled:jest.fn(),disable:jest.fn(),getById:jest.fn().mockResolvedValue(definition),previewUpdate:jest.fn(async(_id,patch)=>({definition,next:{...definition,...patch},count:2,token:'t'})),updateDefinition:jest.fn()};
  const onSaved=jest.fn();
  function Screen(){const state=useTemporalDefinitionSettings({id:definition.id,repository,onSaved:jest.fn()});return <TemporalDefinitionSettingsScreen state={state} onSaved={onSaved}/>;}
  const screen=await render(<Screen/>);
  await waitFor(()=>expect(screen.getByText('初期値に戻す')).toBeTruthy());
  await fireEvent.press(screen.getByLabelText('朝、開始側をぼかすを増やす、現在25%'));
  expect(repository.updateDefinition).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText('変更内容を確認'));
  await waitFor(()=>expect(screen.getByText('変更内容の確認')).toBeTruthy());
  expect(screen.getByText(/参照する保存済み予定: 2件/)).toBeTruthy();
  await fireEvent.press(screen.getByText('保存'));
  await waitFor(()=>expect(onSaved).toHaveBeenCalledTimes(1));
});
