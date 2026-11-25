import { fireEvent, render } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { useDayCalendar, type DayCalendarState } from '../../hooks/use-day-calendar';
import { CalendarDayPreview } from '../calendar-day-preview';

jest.mock('@/global.css', () => ({}));
jest.mock('../../hooks/use-day-calendar');
jest.mock('react-native', () => {
  const native = jest.requireActual<typeof import('react-native')>('react-native');
  jest.spyOn(native, 'useWindowDimensions').mockReturnValue({ width: 350, height: 650, scale: 2, fontScale: 1 });
  return native;
});

const ready: DayCalendarState = {
  status: 'ready', items: [], holidayName: null, holidaySupport: 'available', retry: jest.fn(),
};
const input = {} as ComponentProps<typeof CalendarDayPreview>['input'];
const date = '2026-11-23';
const items = ['終日の予定', '朝の予定', '打ち合わせ', '買い物', '夕食'].map((title, index) => ({
  id: String(index), eventId: String(index), title,
  temporalLabel: ['終日', '朝', '12:00', '午後', '18:00'][index],
  accessibilityLabel: title,
}));

it('プレビューは読み込み中も表示領域の四辺に余白を取る', async () => {
  jest.mocked(useDayCalendar).mockReturnValue({ ...ready, status: 'loading' });
  const view = await render(<CalendarDayPreview date={date} input={input} />);
  expect(StyleSheet.flatten(view.getByTestId('calendar-day-preview').props.style).padding).toBe(12);
});

it('祝日と枠内に収まる予定を読み取り専用で表示し、省略件数を末尾に示す', async () => {
  jest.mocked(useDayCalendar).mockReturnValue({ ...ready, items, holidayName: '勤労感謝の日' });
  const view = await render(<CalendarDayPreview date={date} input={input} />);
  const list = view.getByTestId('calendar-day-preview.agenda');
  await fireEvent(list, 'layout', { nativeEvent: { layout: { height: 180 } } });

  expect(view.getByRole('header', { name: '2026年11月23日の予定' })).toBeOnTheScreen();
  expect(view.getByText('勤労感謝の日')).toBeOnTheScreen();
  expect(view.getByText('終日の予定')).toBeOnTheScreen();
  expect(view.getByText('朝')).toBeOnTheScreen();
  expect(view.getByText('打ち合わせ')).toBeOnTheScreen();
  expect(view.queryByText('買い物')).toBeNull();
  expect(view.getByText('ほか2件')).toBeOnTheScreen();
  expect(view.queryByRole('button')).toBeNull();
  expect(JSON.stringify(view.toJSON())).not.toContain('RCTScrollView');
});

it('すべて収まる日は省略せず、予定が空の日は空表示にする', async () => {
  jest.mocked(useDayCalendar).mockReturnValue(ready);
  const view = await render(<CalendarDayPreview date={date} input={input} />);
  expect(view.getByText('予定はありません')).toBeOnTheScreen();

  jest.mocked(useDayCalendar).mockReturnValue({ ...ready, items });
  await view.rerender(<CalendarDayPreview date={date} input={input} />);
  const list = view.getByTestId('calendar-day-preview.agenda');
  await fireEvent(list, 'layout', { nativeEvent: { layout: { height: 280 } } });
  expect(view.getByText('夕食')).toBeOnTheScreen();
  expect(view.queryByText(/^ほか/)).toBeNull();
});

it('文字が大きい場合は1件分の高さを増やして収まる件数を減らす', async () => {
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 350, height: 650, scale: 2, fontScale: 1.5 });
  jest.mocked(useDayCalendar).mockReturnValue({ ...ready, items });
  const view = await render(<CalendarDayPreview date={date} input={input} />);
  const list = view.getByTestId('calendar-day-preview.agenda');
  await fireEvent(list, 'layout', { nativeEvent: { layout: { height: 180 } } });
  expect(view.getByText('ほか4件')).toBeOnTheScreen();
});
