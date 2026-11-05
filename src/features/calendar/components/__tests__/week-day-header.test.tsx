import { render, userEvent } from '@testing-library/react-native';
import { WeekDayHeader } from '../week-day-header';
import type { TwoDayViewModel } from '../../two-day-view-model';
jest.mock('@/global.css', () => ({}));

const day: TwoDayViewModel = { date: '2026-11-05', dateLabel: '11月5日', weekdayLabel: '木', isToday: true,
  holidayName: null, holidaySupport: 'available', allDayItems: [], timelineItems: [], accessibilityLabel: '2026年11月5日、木曜日、今日、予定3件' };
describe('週の日付見出し', () => {
  it('省略件数を読み上げ、日付から対象日の1日表示を開く', async () => {
    const onOpenDay = jest.fn();
    const view = await render(<WeekDayHeader day={day} hiddenCount={2} height={72} allDayHeight={44} selected hidden={false} onOpenDay={onOpenDay} />);
    const button = view.getByRole('button', { name: '2026年11月5日、木曜日、今日、予定3件、他2件、1日表示を開く' });
    expect(button.props.accessibilityState.selected).toBe(true);
    expect(view.getByText('他2件')).toBeOnTheScreen();
    expect(view.getByText('他2件').props.numberOfLines).toBeUndefined();
    await userEvent.setup().press(button);
    expect(onOpenDay).toHaveBeenCalledWith('2026-11-05');
  });
  it('予備日は読み上げと操作対象から除く', async () => {
    const view = await render(<WeekDayHeader day={day} hiddenCount={0} height={72} allDayHeight={0} selected={false} hidden onOpenDay={jest.fn()} />);
    expect(view.queryByRole('button')).toBeNull();
  });
});
