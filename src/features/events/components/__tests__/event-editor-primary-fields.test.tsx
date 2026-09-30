import { act, fireEvent, render } from '@testing-library/react-native';
import { EventDateTimeFields } from '../event-date-time-fields';
import { EventEditorHeader } from '../event-editor-header';
import { EventEditorTabs } from '../event-editor-tabs';

jest.mock('@/global.css', () => ({}));
jest.mock('@expo/ui/community/datetime-picker', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { __esModule: true, default: View };
});

describe('予定編集の基本項目', () => {
  it('中央タイトルと同じ幅の左右操作を表示する', async () => {
    const view = await render(<EventEditorHeader mode="create" busy={false} ready onCancel={jest.fn()} onSave={jest.fn()} />);
    expect(view.getByText('予定を追加')).toBeOnTheScreen();
    expect(view.getByLabelText('キャンセル').parent?.props.style).toEqual(view.getByLabelText('保存').parent?.props.style);
  });

  it('2つのタブに選択状態を付ける', async () => {
    const onChange = jest.fn();
    const view = await render(<EventEditorTabs value="fuzzy" disabled={false} onChange={onChange} />);
    expect(view.getByLabelText('ざっくり').props.accessibilityState).toMatchObject({ selected: true });
    expect(view.getByLabelText('きっちり').props.accessibilityState).toMatchObject({ selected: false });
    fireEvent.press(view.getByLabelText('きっちり'));
    expect(onChange).toHaveBeenCalledWith('exact');
  });

  it('日時を日本語で表示し操作時だけpickerを開く', async () => {
    const view = await render(<EventDateTimeFields
      editorTab="exact"
      isAllDay={false}
      isDateEditable
      startDate="2026-09-25"
      startTime="09:30"
      endDate="2026-09-26"
      endTime="11:45"
      disabled={false}
      onAllDayChange={jest.fn()}
      onStartDateChange={jest.fn()}
      onStartTimeChange={jest.fn()}
      onEndDateChange={jest.fn()}
      onEndTimeChange={jest.fn()}
    />);
    expect(view.getByText('9月25日（金）')).toBeOnTheScreen();
    expect(view.getByText('9月26日（土）')).toBeOnTheScreen();
    expect(view.queryByTestId('event-editor.start-date-picker')).toBeNull();
    await act(async () => { fireEvent.press(view.getByLabelText('開始日 9月25日（金）')); });
    expect(view.getByTestId('event-editor.start-date-picker')).toBeOnTheScreen();
  });
});
