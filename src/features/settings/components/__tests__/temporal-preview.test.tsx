import {fireEvent,render} from '@testing-library/react-native';
import {StyleSheet} from 'react-native';
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

it('日内予定の境界を縦にドラッグすると5%単位で変わり、操作中はスクロールを止める', async () => {
  const onChange = jest.fn();
  const onDraggingChange = jest.fn();
  const onSnap = jest.fn();
  const screen = await render(<TemporalPreview definition={definitions[0]}
    onChange={onChange} onDraggingChange={onDraggingChange} onSnap={onSnap} />);
  await fireEvent(screen.getByTestId('temporal-preview.track'), 'layout', {
    nativeEvent: { layout: { width: 300, height: 200 } },
  });
  const start = screen.getByRole('adjustable', { name: '開始側のぼかし' });
  await fireEvent(start, 'responderGrant', { nativeEvent: { pageY: 100 } });
  await fireEvent(start, 'responderMove', { nativeEvent: { pageY: 112, touches: [{}] } });
  await fireEvent(start, 'responderMove', { nativeEvent: { pageY: 113, touches: [{}] } });
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith({ fadeInRatio: 0.3 });
  expect(onSnap).toHaveBeenCalledTimes(1);
  expect(onDraggingChange).toHaveBeenLastCalledWith(true);
  await fireEvent(start, 'responderTerminate');
  expect(onDraggingChange).toHaveBeenLastCalledWith(false);
});

it('週の終了側を横に動かすと開始側と重ならない5%単位を上限にする', async () => {
  const definition = { ...definitions.find((item) => item.key === 'next_week')!, fadeInRatio: 0.35, fadeOutRatio: 0.2 };
  const onChange = jest.fn();
  const screen = await render(<TemporalPreview definition={definition} onChange={onChange} onDraggingChange={jest.fn()} />);
  await fireEvent(screen.getByTestId('temporal-preview.track'), 'layout', {
    nativeEvent: { layout: { width: 200, height: 200 } },
  });
  const end = screen.getByRole('adjustable', { name: '終了側のぼかし' });
  await fireEvent(end, 'responderGrant', { nativeEvent: { pageX: 180, pageY: 100 } });
  await fireEvent(end, 'responderMove', { nativeEvent: { pageX: 10, pageY: 100, touches: [{}] } });
  expect(onChange).toHaveBeenCalledWith({ fadeOutRatio: 0.65 });
});


it('朝に時刻線を毎時表示し、開始・終了と中間の8時を目盛りで示す', async () => {
  const screen = await render(<TemporalPreview definition={definitions[0]} />);
  expect(screen.getAllByTestId(/temporal-preview\.clock-line/)).toHaveLength(5);
  expect(screen.getByText('6:00')).toBeOnTheScreen();
  expect(screen.getByText('8:00')).toBeOnTheScreen();
  expect(screen.getByText('10:00')).toBeOnTheScreen();
  expect(screen.queryByText('7:00')).toBeNull();
});

it('今週前半のプレビューに日境界と曜日の目盛りを表示する', async () => {
  const definition = definitions.find((item) => item.key === 'this_week_first_half')!;
  const screen = await render(<TemporalPreview definition={definition} />);
  expect(screen.getAllByTestId(/temporal-preview\.day-boundary/)).toHaveLength(2);
  expect(screen.getByLabelText('月曜日')).toBeOnTheScreen();
  expect(screen.getByLabelText('火曜日')).toBeOnTheScreen();
  expect(screen.getByLabelText('水曜日')).toBeOnTheScreen();
});

it('終了が開始以前の下書きでも、両端の時刻を操作できる', async () => {
  const definition = { ...definitions[0], resolverConfig: { kind: 'timeOfDay' as const, startMinute: 660, endMinute: 600 } };
  const onEditClock = jest.fn();
  const screen = await render(<TemporalPreview definition={definition} onEditClock={onEditClock} />);
  await fireEvent.press(screen.getByRole('button', { name: '開始時刻、11:00' }));
  expect(onEditClock).toHaveBeenCalledWith('startMinute');
  expect(screen.getByRole('button', { name: '終了時刻、10:00' })).toBeOnTheScreen();
});


it('横軸の左端にあるつまみは、プレビューの外側にも44ptの操作領域を確保する', async () => {
  const definition = definitions.find((item) => item.key === 'this_week_first_half')!;
  const screen = await render(<TemporalPreview definition={definition} onChange={jest.fn()} onDraggingChange={jest.fn()} />);
  await fireEvent(screen.getByTestId('temporal-preview.track'), 'layout', {
    nativeEvent: { layout: { width: 200, height: 78 } },
  });
  const start = screen.getByRole('adjustable', { name: '開始側のぼかし' });
  const layer = screen.getByTestId('temporal-preview.handles');
  expect(StyleSheet.flatten(layer.props.style)).toMatchObject({ width: 244, right: 0, top: 4 });
  expect(StyleSheet.flatten(start.props.style)).toMatchObject({ left: 0, width: 44, height: 44 });
});
