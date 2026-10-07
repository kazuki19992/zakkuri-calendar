import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { DurationWheelPicker } from '../duration-wheel-picker';

jest.mock('@/global.css', () => ({}));
jest.mock('@/hooks/use-reduce-motion', () => ({ useReduceMotion: jest.fn(() => false) }));

describe('予定通知時間ドラムロール', () => {
  it('時と分を選択して合計分を確定する', async () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    const view = await render(<DurationWheelPicker visible initialMinutes={90} maxHours={23}
      onConfirm={onConfirm} onClose={onClose} />);
    expect(view.getByLabelText('通知時間、1時間30分前')).toBeOnTheScreen();

    await fireEvent(view.getByTestId('duration-wheel.hours'), 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { y: 23 * 44 } },
    });
    await fireEvent(view.getByTestId('duration-wheel.minutes'), 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { y: 59 * 44 } },
    });
    await fireEvent.press(view.getByLabelText('通知時間を確定'));

    expect(onConfirm).toHaveBeenCalledWith(1_439);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('慣性スクロールなしでドラッグを終えた値を確定する', async () => {
    const onConfirm = jest.fn();
    const view = await render(<DurationWheelPicker visible initialMinutes={0} maxHours={23}
      onConfirm={onConfirm} onClose={jest.fn()} />);

    await fireEvent(view.getByTestId('duration-wheel.hours'), 'scrollEndDrag', {
      nativeEvent: { contentOffset: { y: 2 * 44 } },
    });
    await fireEvent(view.getByTestId('duration-wheel.minutes'), 'scrollEndDrag', {
      nativeEvent: { contentOffset: { y: 15 * 44 } },
    });
    await fireEvent.press(view.getByLabelText('通知時間を確定'));

    expect(onConfirm).toHaveBeenCalledWith(135);
  });

  it('0分は予定時刻と読み上げ、範囲外の初期値をclampする', async () => {
    const view = await render(<DurationWheelPicker visible initialMinutes={-10} maxHours={23}
      onConfirm={jest.fn()} onClose={jest.fn()} />);
    expect(view.getByLabelText('通知時間、予定時刻')).toBeOnTheScreen();

    await view.rerender(<DurationWheelPicker visible initialMinutes={2_000} maxHours={23}
      onConfirm={jest.fn()} onClose={jest.fn()} />);
    expect(view.getByLabelText('通知時間、23時間59分前')).toBeOnTheScreen();
  });

  it('取消、背景、Android backでは確定せず閉じる', async () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    const view = await render(<DurationWheelPicker visible initialMinutes={30} maxHours={23}
      onConfirm={onConfirm} onClose={onClose} />);

    const backdrop = view.getByTestId('duration-wheel.backdrop', { includeHiddenElements: true });
    expect(backdrop.props).toMatchObject({ accessible: false, importantForAccessibility: 'no' });
    await fireEvent.press(backdrop);
    await fireEvent.press(view.getByLabelText('キャンセル'));
    view.getByTestId('duration-wheel.modal').props.onRequestClose();

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('各選択行を44pt以上にし、Reduce Motionなら即時表示する', async () => {
    jest.mocked(useReduceMotion).mockReturnValue(true);
    const view = await render(<DurationWheelPicker visible initialMinutes={0} maxHours={23}
      onConfirm={jest.fn()} onClose={jest.fn()} />);

    expect(view.getByTestId('duration-wheel.modal').props.animationType).toBe('none');
    expect(StyleSheet.flatten(view.getByTestId('duration-wheel.hours-option-0').props.style).height)
      .toBeGreaterThanOrEqual(44);
    expect(StyleSheet.flatten(view.getByTestId('duration-wheel.minutes-option-0').props.style).height)
      .toBeGreaterThanOrEqual(44);
    jest.mocked(useReduceMotion).mockReturnValue(false);
  });
});
