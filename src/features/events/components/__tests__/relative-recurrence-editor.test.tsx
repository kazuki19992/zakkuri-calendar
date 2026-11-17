import {render,fireEvent} from '@testing-library/react-native';
import {RecurrenceEditor} from '../recurrence-editor';
import {getRecurrenceDraft} from '../../event-editor-model';
jest.mock('@/global.css',()=>({}));
jest.mock('@expo/ui/community/datetime-picker',()=>{const React=jest.requireActual<typeof import('react')>('react');const {View}=jest.requireActual<typeof import('react-native')>('react-native');return function MockDatePicker(props:Record<string,unknown>){return React.createElement(View,props);};});
it('対象月のテキストから直接pickerを開き、月初へ正規化する',async()=>{
  const onUntilDateChange=jest.fn();
  const draft={...getRecurrenceDraft(null,'2026-11-17'),preset:'custom' as const,frequency:'monthly' as const,endType:'until' as const,untilDate:''};
  const screen=await render(<RecurrenceEditor draft={draft} relativeFrequency="monthly" relativeInitialDate="2026-11-01" disabled={false} error={null} onPresetChange={jest.fn()} onFrequencyChange={jest.fn()} onIntervalChange={jest.fn()} onWeekdayToggle={jest.fn()} onEndTypeChange={jest.fn()} onUntilDateChange={onUntilDateChange} onCountChange={jest.fn()}/>);
  await fireEvent.press(screen.getByLabelText('終了する対象月を選択'));
  await fireEvent(screen.getByTestId('relative-recurrence.until-picker'),'onValueChange',{},new Date(2027,1,15));
  expect(onUntilDateChange).toHaveBeenCalledWith('2027-02-01');
});
