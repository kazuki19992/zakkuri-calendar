import {render,fireEvent} from '@testing-library/react-native';
import {TemporalRangeFields} from '../temporal-range-fields';
import {createStandardTemporalDefinitions} from '@/domain/temporal/standard-definitions';
import {formatTemporalRange} from '../../temporal-preferences-model';
jest.mock('@/global.css',()=>({}));
const definitions=createStandardTemporalDefinitions('personal-default','2026-11-13');
it.each(definitions)('$label の範囲を文字でも確認できる',async definition=>{
  const screen=await render(<TemporalRangeFields definition={definition} onChange={jest.fn()} disabled={false}/>);
  expect(screen.getByText(formatTemporalRange(definition))).toBeTruthy();
});
it('深夜の翌日指定を明示して選択できる',async()=>{
  const definition=definitions.find(d=>d.key==='late_night')!;const onChange=jest.fn();
  const screen=await render(<TemporalRangeFields definition={definition} onChange={onChange} disabled={false}/>);
  expect(screen.getByText('22:00〜翌日2:00')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('終了する日、翌日'));
  await fireEvent.press(screen.getByText('当日'));
  expect(onChange).toHaveBeenCalledWith({resolverConfig:{kind:'timeOfDay',startMinute:1320,endMinute:120}});
});
