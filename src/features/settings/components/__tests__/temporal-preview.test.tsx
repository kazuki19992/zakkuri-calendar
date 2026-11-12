import {render} from '@testing-library/react-native';
import {TemporalPreview} from '../temporal-preview';
import {createStandardTemporalDefinitions} from '@/domain/temporal/standard-definitions';
jest.mock('@/global.css',()=>({}));
const definitions=createStandardTemporalDefinitions('personal-default','2026-11-13');
it.each(['next_week','month_start','month_end'])('%sの期間が1日なら実カレンダーと同じくぼかさない',async key=>{
  const original=definitions.find(d=>d.key===key)!;
  const resolver=original.resolverConfig;
  const definition={...original,fadeInRatio:.25,fadeOutRatio:.25,resolverConfig:
    resolver.kind==='week'?{...resolver,startWeekday:1 as const,endWeekday:1 as const}:
    resolver.kind==='monthDays'?{...resolver,startDay:1,endDay:1}:resolver.kind==='monthLastDays'?{...resolver,count:1}:resolver};
  const screen=await render(<TemporalPreview definition={definition}/>);
  const gradient=screen.getByTestId('temporal-preview.gradient');
  // native境界ではprocessColorによりARGB整数へ変換される。
  expect(gradient.props.colors.every((color:number)=>(color>>>24)===255)).toBe(true);
});
