import { fireEvent, render, screen } from '@testing-library/react-native';
import { ExactDurationTypeField } from '../exact-duration-type-field';
import { EventDateTimeFields } from '../event-date-time-fields';

jest.mock('@/global.css', () => ({}));
jest.mock('@/hooks/use-reduce-motion', () => ({ useReduceMotion: () => true }));
jest.mock('@expo/ui/community/datetime-picker', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { __esModule: true, default: View };
});
const fields = { editorTab: 'exact' as const, isAllDay: false, isDateEditable: true,
  startDate: '2026-12-31', startTime: '23:30', endDate: '2027-01-01', endTime: '00:30', disabled: false,
  onAllDayChange: jest.fn(), onStartDateChange: jest.fn(), onStartTimeChange: jest.fn(), onEndDateChange: jest.fn(), onEndTimeChange: jest.fn() };

describe('終了の指定', () => {
  it('3種類を単一選択し色以外でも現在値を示す', async () => {
    const onChange = jest.fn();
    await render(<ExactDurationTypeField value="fixed" status="ready" disabled={false} onChange={onChange} onRetry={jest.fn()} />);
    await fireEvent.press(screen.getByRole('button', { name: '終了、時刻を指定' }));
    expect(screen.getByRole('button', { name: '時刻を指定、選択中' }).props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: '長さなし' }));
    expect(onChange).toHaveBeenCalledWith('instant');
  });
  it('長さなしと未定では隠れた終了ピッカーを表示しないが終日は終了日を表示する', async () => {
    const view = await render(<EventDateTimeFields {...fields} showEnd={false} />);
    expect(screen.queryByText('終了日')).toBeNull();
    expect(screen.queryByText('終了時刻')).toBeNull();
    await view.rerender(<EventDateTimeFields {...fields} showEnd={false} isAllDay />);
    expect(screen.getByText('終了日')).toBeOnTheScreen();
  });
  it('初期化失敗では時刻入力を止めても終日切替は使え再試行できる', async () => {
    await render(<><ExactDurationTypeField value="fixed" status="error" disabled={false} onChange={jest.fn()} onRetry={fields.onEndTimeChange} />
      <EventDateTimeFields {...fields} timeInputDisabled /></>);
    expect(screen.getByRole('button', { name: '開始時刻 23:30' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: '終日' })).toBeEnabled();
    await fireEvent.press(screen.getByRole('button', { name: '初期の長さを再読み込み' }));
    expect(fields.onEndTimeChange).toHaveBeenCalled();
  });
});
