import {render,fireEvent,waitFor} from '@testing-library/react-native';
import {TemporalDefinitionSettingsScreen,TemporalDefinitionSaveAction} from '../../screens/temporal-definition-settings-screen';
import {useTemporalDefinitionSettings} from '../../hooks/use-temporal-definition-settings';
import {createStandardTemporalDefinitions} from '@/domain/temporal/standard-definitions';
import type {TemporalDefinitionRepository} from '@/domain/calendar/repositories';
jest.mock('@/global.css',()=>({}));
const definition=createStandardTemporalDefinitions('personal-default','2026-11-13')[0];
it('ぼかしを編集しても確認まで保存せず、読み上げ名と差分を示して確定する',async()=>{
  const repository:TemporalDefinitionRepository={listEditable:jest.fn(),listEnabled:jest.fn(),disable:jest.fn(),getById:jest.fn().mockResolvedValue(definition),previewUpdate:jest.fn(async(_id,patch)=>({definition,next:{...definition,...patch},count:2,token:'t'})),updateDefinition:jest.fn()};
  const onSaved=jest.fn();
  function Screen(){const state=useTemporalDefinitionSettings({id:definition.id,repository,onSaved:jest.fn()});return <><TemporalDefinitionSaveAction state={state}/><TemporalDefinitionSettingsScreen state={state} onSaved={onSaved}/></>;}
  const screen=await render(<Screen/>);
  await waitFor(()=>expect(screen.getByText('初期値に戻す')).toBeTruthy());
  expect(screen.queryByRole('adjustable', { name: '開始側のぼかし' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'ぼかしを調整' }));
  const adjustment = screen.getByTestId('temporal-fade.modal');
  expect(adjustment.props).toMatchObject({ presentationStyle: 'fullScreen', allowSwipeDismissal: false });
  expect(screen.getByTestId('temporal-fade.screen').props.edges).toMatchObject({
    top: 'additive', left: 'additive', bottom: 'additive', right: 'additive',
  });
  await fireEvent(adjustment, 'requestClose');
  expect(screen.getByRole('button', { name: '完了' })).toBeOnTheScreen();
  await fireEvent(screen.getByRole('adjustable', { name: '開始側のぼかし' }), 'accessibilityAction', {
    nativeEvent: { actionName: 'increment' },
  });
  expect(repository.updateDefinition).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'キャンセル' }));
  expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'ぼかしを調整' }));
  await fireEvent(screen.getByRole('adjustable', { name: '開始側のぼかし' }), 'accessibilityAction', {
    nativeEvent: { actionName: 'increment' },
  });
  await fireEvent.press(screen.getByRole('button', { name: '完了' }));
  expect(repository.previewUpdate).not.toHaveBeenCalled();
  const headerSave = screen.getByRole('button', { name: '保存' });
  expect(headerSave).toBeEnabled();
  await fireEvent.press(headerSave);
  await waitFor(()=>expect(screen.getByText('変更内容の確認')).toBeTruthy());
  expect(screen.getByTestId('temporal-definition.confirmation').props.edges).toMatchObject({
    top: 'additive', left: 'additive', bottom: 'additive', right: 'additive',
  });
  expect(screen.getByText(/既存の予定2件/)).toBeTruthy();
  await fireEvent.press(screen.getByText('保存する'));
  await waitFor(()=>expect(onSaved).toHaveBeenCalledTimes(1));
});

it('今週中の詳細で締切曜日と休日調整を変更できる', async () => {
  const thisWeek = createStandardTemporalDefinitions('personal-default', '2026-11-13').find((item) => item.key === 'this_week')!;
  const repository: TemporalDefinitionRepository = {
    listEditable: jest.fn(), listEnabled: jest.fn(), disable: jest.fn(),
    getById: jest.fn().mockResolvedValue(thisWeek), previewUpdate: jest.fn(), updateDefinition: jest.fn(),
  };
  const setWeekday = jest.fn();
  const setValue = jest.fn();
  function Screen() {
    const state = useTemporalDefinitionSettings({ id: thisWeek.id, repository, onSaved: jest.fn() });
    return <TemporalDefinitionSettingsScreen state={state} onSaved={jest.fn()} thisWeek={{
      deadline: { weekday: 5, status: 'ready', error: null, isSaving: false, reload: jest.fn(), setWeekday },
      holidays: { value: { version: 1, calendarId: 'jp', adjustThisWeekDeadline: false },
        status: 'ready', error: null, isSaving: false, reload: jest.fn(), setValue },
    }} />;
  }
  const screen = await render(<Screen />);
  await waitFor(() => expect(screen.getByRole('header', { name: '今週中の締切' })).toBeOnTheScreen());
  await fireEvent.press(screen.getByRole('button', { name: '締切の曜日、金曜日' }));
  await fireEvent.press(screen.getByRole('button', { name: '日曜日' }));
  expect(setWeekday).toHaveBeenCalledWith(7);
  await fireEvent(screen.getByRole('switch', { name: '締切を直前の平日に繰り上げる' }), 'valueChange', true);
  expect(setValue).toHaveBeenCalledWith({ version: 1, calendarId: 'jp', adjustThisWeekDeadline: true });
  expect(repository.updateDefinition).not.toHaveBeenCalled();
});


it('深夜の終了時刻はプレビューのラベルから15分刻みで変更し、翌日指定を維持する', async () => {
  const lateNight = createStandardTemporalDefinitions('personal-default', '2026-11-13').find((item) => item.key === 'late_night')!;
  const repository: TemporalDefinitionRepository = {
    listEditable: jest.fn(), listEnabled: jest.fn(), disable: jest.fn(),
    getById: jest.fn().mockResolvedValue(lateNight), previewUpdate: jest.fn(), updateDefinition: jest.fn(),
  };
  function Screen() {
    const state = useTemporalDefinitionSettings({ id: lateNight.id, repository, onSaved: jest.fn() });
    return <TemporalDefinitionSettingsScreen state={state} onSaved={jest.fn()} />;
  }
  const screen = await render(<Screen />);
  const endLabel = '終了時刻、翌日2:00';
  await waitFor(() => expect(screen.getByRole('button', { name: endLabel })).toBeOnTheScreen());
  await fireEvent.press(screen.getByRole('button', { name: endLabel }));
  expect(screen.getByRole('header', { name: '終了時刻' })).toBeOnTheScreen();
  expect(screen.queryByTestId('duration-wheel.minutes-option-14')).toBeNull();
  await fireEvent.press(screen.getByTestId('duration-wheel.minutes-option-15'));
  await fireEvent.press(screen.getByRole('button', { name: 'キャンセル' }));
  expect(screen.getByRole('button', { name: endLabel })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: endLabel }));
  await fireEvent(screen.getByTestId('duration-wheel.minutes'), 'momentumScrollEnd', {
    nativeEvent: { contentOffset: { y: 44 } },
  });
  await fireEvent.press(screen.getByRole('button', { name: '終了時刻を確定' }));
  expect(screen.getByRole('button', { name: '終了時刻、翌日2:15' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: '終了する日、翌日' })).toBeOnTheScreen();
  expect(repository.updateDefinition).not.toHaveBeenCalled();
});
