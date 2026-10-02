import { act, fireEvent, render } from '@testing-library/react-native';
import { EventColorPicker } from '../event-color-picker';
import { EventMetadataFields, EventNoteField } from '../event-metadata-fields';
import { EventReminderEditor } from '../event-reminder-editor';
import { RecurrenceEditor } from '../recurrence-editor';

jest.mock('@/global.css', () => ({}));

describe('予定編集の追加項目', () => {
  it('繰り返しpresetとcustom項目を表示する', async () => {
    const onPresetChange = jest.fn();
    const props = {
      draft: { preset: 'none' as const, frequency: 'weekly' as const, intervalText: '1', weekdays: [1], endType: 'never' as const, untilDate: '2026-09-25', countText: '1' },
      disabled: false,
      error: null,
      onPresetChange,
      onFrequencyChange: jest.fn(),
      onIntervalChange: jest.fn(),
      onWeekdayToggle: jest.fn(),
      onEndTypeChange: jest.fn(),
      onUntilDateChange: jest.fn(),
      onCountChange: jest.fn(),
    };
    const view = await render(<RecurrenceEditor {...props} />);
    expect(view.getByLabelText('繰り返しなし').props.accessibilityState).toMatchObject({ selected: true });
    expect(view.getByLabelText('カスタム')).toBeOnTheScreen();
    await act(async () => { fireEvent.press(view.getByLabelText('カスタム')); });
    expect(onPresetChange).toHaveBeenCalledWith('custom');
    await view.rerender(<RecurrenceEditor {...props} draft={{ ...props.draft, preset: 'custom' }} />);
    expect(view.getByLabelText('繰り返し間隔')).toBeOnTheScreen();
  });

  it('継承色と固定8色をラベル付きで表示する', async () => {
    const view = await render(<EventColorPicker calendarColorId="blue" value={null} disabled={false} onChange={jest.fn()} />);
    expect(view.getByLabelText('カレンダーの色').props.accessibilityState).toMatchObject({ selected: true });
    expect(view.getByLabelText('赤')).toBeOnTheScreen();
    expect(view.getAllByRole('button')).toHaveLength(9);
  });

  it('場所とメモeditorへの導線を表示する', async () => {
    const view = await render(<>
      <EventMetadataFields location="" disabled={false} onLocationChange={jest.fn()} />
      <EventNoteField summary="買い物リスト" disabled={false} error={null} onPress={jest.fn()} />
    </>);
    expect(view.getByLabelText('場所')).toBeOnTheScreen();
    expect(view.getByLabelText('メモを編集')).toBeOnTheScreen();
    expect(view.getByText('買い物リスト')).toBeOnTheScreen();
  });

  it('通知未発火の説明と並べ替え操作を表示する', async () => {
    const view = await render(<EventReminderEditor reminders={[{ id: 'r1', minutesBefore: 30 }]} disabled={false} error={null} onAdd={jest.fn()} onRemove={jest.fn()} onMove={jest.fn()} />);
    expect(view.getByText('設定は保存されますが、端末への通知はまだ行われません')).toBeOnTheScreen();
    expect(view.getByLabelText('30分前を上へ')).toBeDisabled();
    expect(view.getByLabelText('30分前を削除')).toBeOnTheScreen();
  });
});
