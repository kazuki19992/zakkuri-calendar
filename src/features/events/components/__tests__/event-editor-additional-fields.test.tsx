import { fireEvent, render, userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { EventColorPicker } from '../event-color-picker';
import { EventMetadataFields, EventNoteField } from '../event-metadata-fields';
import { EventReminderEditor } from '../event-reminder-editor';
import { RecurrenceEditor } from '../recurrence-editor';

jest.mock('@/global.css', () => ({}));
jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: jest.fn(() => 'light') }));

describe('予定編集の追加項目', () => {
  it('繰り返しの単一選択をdropdownで変更する', async () => {
    const user = userEvent.setup();
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
    await user.press(view.getByLabelText('パターン、繰り返しなし、選択する'));
    await user.press(view.getByLabelText('カスタム'));
    expect(onPresetChange).toHaveBeenCalledWith('custom');
    await view.rerender(<RecurrenceEditor {...props} draft={{ ...props.draft, preset: 'custom' }} />);
    expect(view.getByLabelText('繰り返し間隔')).toBeOnTheScreen();
    await user.press(view.getByLabelText('単位、週、選択する'));
    await user.press(view.getByLabelText('月'));
    expect(props.onFrequencyChange).toHaveBeenCalledWith('monthly');
    await user.press(view.getByLabelText('終了条件、終了なし、選択する'));
    await user.press(view.getByLabelText('回数'));
    expect(props.onEndTypeChange).toHaveBeenCalledWith('count');
  });

  it('複数選択の曜日は位置を変えないbadgeと選択状態を併用する', async () => {
    const props = {
      draft: { preset: 'custom' as const, frequency: 'weekly' as const, intervalText: '1',
        weekdays: [1], endType: 'never' as const, untilDate: '2026-09-25', countText: '1' },
      disabled: false,
      error: null,
      onPresetChange: jest.fn(),
      onFrequencyChange: jest.fn(),
      onIntervalChange: jest.fn(),
      onWeekdayToggle: jest.fn(),
      onEndTypeChange: jest.fn(),
      onUntilDateChange: jest.fn(),
      onCountChange: jest.fn(),
    };
    const view = await render(<RecurrenceEditor {...props} />);
    expect(view.getByLabelText('月曜日').props.accessibilityState.selected).toBe(true);
    expect(view.getByTestId('event-editor.recurrence-weekday-1-check')).toBeOnTheScreen();
    expect(view.queryByTestId('event-editor.recurrence-weekday-2-check')).toBeNull();
  });

  it('色名と色見本を表示しdropdownで単一選択する', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const view = await render(<EventColorPicker calendarColorId="blue" value={null} disabled={false} onChange={onChange} />);
    expect(view.getByTestId('event-editor.selected-color-swatch')).toBeOnTheScreen();
    await user.press(view.getByLabelText('予定の色、カレンダーの色、選択する'));
    expect(view.getByLabelText('赤')).toBeOnTheScreen();
    expect(StyleSheet.flatten(view.getByTestId('event-editor.color-option-red-swatch').props.style))
      .toMatchObject({ backgroundColor: '#B3261E' });
    await user.press(view.getByLabelText('赤'));
    expect(onChange).toHaveBeenCalledWith('red');
  });

  it('dark themeでも各色候補に対応する色見本を表示する', async () => {
    jest.mocked(useColorScheme).mockReturnValue('dark');
    const user = userEvent.setup();
    const view = await render(<EventColorPicker calendarColorId="blue" value="red"
      disabled={false} onChange={jest.fn()} />);
    await user.press(view.getByLabelText('予定の色、赤、選択する'));
    expect(StyleSheet.flatten(view.getByTestId('event-editor.color-option-red-swatch').props.style))
      .toMatchObject({ backgroundColor: '#F28B82' });
    jest.mocked(useColorScheme).mockReturnValue('light');
  });

  it('disabledの単一選択項目はシートを開かない', async () => {
    const user = userEvent.setup();
    const view = await render(<EventColorPicker calendarColorId="blue" value={null}
      disabled onChange={jest.fn()} />);
    const field = view.getByLabelText('予定の色、カレンダーの色、選択する');
    expect(field).toBeDisabled();
    await user.press(field);
    expect(view.queryByText('赤')).toBeNull();
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

  it('旧通知の開始基準を表示し複数通知を並べ替え・削除できる', async () => {
    const onMove=jest.fn(),onRemove=jest.fn();
    const view=await render(<EventReminderEditor reminders={[{id:'r1',minutesBefore:30},{id:'r2',minutesBefore:60}]} disabled={false} error={null} onAdd={jest.fn()} onRemove={onRemove} onMove={onMove}/>);
    expect(view.getByText('開始30分前（以前の設定）')).toBeOnTheScreen();
    await fireEvent.press(view.getByLabelText('通知2を上へ'));expect(onMove).toHaveBeenCalledWith('r2',-1);
    await fireEvent.press(view.getByLabelText('通知1を削除'));expect(onRemove).toHaveBeenCalledWith('r1');
  });
  it('60分以上の通知は基準と時分を表示する',async()=>{
    const view=await render(<EventReminderEditor reminders={[{id:'r',timing:{version:1,kind:'relativeMinutes',anchor:'end',minutesBefore:90}}]} disabled={false} error={null} onAdd={jest.fn()} onRemove={jest.fn()} onMove={jest.fn()}/>);
    expect(view.getByText('終了1時間30分前')).toBeOnTheScreen();
  });
  it('日・時・分のドラムから通知を追加する',async()=>{
    const onAdd=jest.fn();
    const view=await render(<EventReminderEditor reminders={[]} disabled={false} error={null} onAdd={onAdd} onRemove={jest.fn()} onMove={jest.fn()}/>);
    await fireEvent.press(view.getByLabelText('通知を追加'));
    await fireEvent(view.getByTestId('notification-wheel.hours'),'momentumScrollEnd',{nativeEvent:{contentOffset:{y:88}}});
    await fireEvent(view.getByTestId('notification-wheel.minutes'),'momentumScrollEnd',{nativeEvent:{contentOffset:{y:15*44}}});
    await fireEvent.press(view.getByLabelText('通知タイミングを確定'));
    expect(onAdd).toHaveBeenCalledWith({version:1,kind:'relativeMinutes',anchor:'start',minutesBefore:135});
  });
  it('通知行の編集は追加ではなく指定IDの変更として返す',async()=>{
    const onUpdate=jest.fn(),onAdd=jest.fn();
    const view=await render(<EventReminderEditor reminders={[{id:'r',timing:{version:1,kind:'relativeMinutes',anchor:'start',minutesBefore:10}}]} disabled={false} error={null} onAdd={onAdd} onUpdate={onUpdate} onRemove={jest.fn()} onMove={jest.fn()}/>);
    await fireEvent.press(view.getByLabelText('通知を変更、開始10分前'));
    await fireEvent(view.getByTestId('notification-wheel.minutes'),'momentumScrollEnd',{nativeEvent:{contentOffset:{y:0}}});
    await fireEvent.press(view.getByLabelText('通知タイミングを確定'));
    expect(onUpdate).toHaveBeenCalledWith('r',{version:1,kind:'relativeMinutes',anchor:'start',minutesBefore:0});expect(onAdd).not.toHaveBeenCalled();
  });
});
