import { render, fireEvent } from '@testing-library/react-native';
import { ReminderTimingPicker } from '../reminder-timing-picker';
jest.mock('@/global.css', () => ({}));
jest.mock('@/hooks/use-reduce-motion', () => ({ useReduceMotion: () => true }));
describe('通知の日数時分入力', () => {
  test('日数と時分を確定し開始終了基準を保持する', async () => {
    const onConfirm = jest.fn();
    const view = await render(
      <ReminderTimingPicker
        visible

        value={{
          version: 1,
          kind: 'relativeMinutes',
          anchor: 'end',
          minutesBefore: 60,
        }}
        onConfirm={onConfirm}
        onClose={() => {}}
      />,
    );
    await fireEvent(
      view.getByTestId('notification-wheel.minutes'),
      'momentumScrollEnd',
      { nativeEvent: { contentOffset: { y: 30 * 44 } } },
    );
    await fireEvent.press(view.getByLabelText('通知タイミングを確定'));
    expect(onConfirm).toHaveBeenCalledWith({
      version: 1,
      kind: 'relativeMinutes',
      anchor: 'end',
      minutesBefore: 90,
    });
  });
  test('日付だけの通知は前日9時を日数と時刻のまま返す', async () => {
    const onConfirm = jest.fn();
    const view = await render(
      <ReminderTimingPicker
        visible

        value={{
          version: 1,
          kind: 'relativeDate',
          anchor: 'end',
          daysBefore: 1,
          time: '09:00',
        }}
        onConfirm={onConfirm}
        onClose={() => {}}
      />,
    );
    await fireEvent.press(view.getByLabelText('通知タイミングを確定'));
    expect(onConfirm).toHaveBeenCalledWith({
      version: 1,
      kind: 'relativeDate',
      anchor: 'end',
      daysBefore: 1,
      time: '09:00',
    });
  });
});
