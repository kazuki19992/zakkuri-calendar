import { act, fireEvent, render } from '@testing-library/react-native';
import { EventDateTimeFields } from '../event-date-time-fields';
import { EventEditorHeader } from '../event-editor-header';
import { EventEditorTabs } from '../event-editor-tabs';
import { TemporalDefinitionPicker } from '../temporal-definition-picker';
import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';

jest.mock('@/global.css', () => ({}));
jest.mock('@expo/ui/community/datetime-picker', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { __esModule: true, default: View };
});
jest.mock('@expo/ui', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  function Host({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) {
    return ReactModule.createElement(View, props, children);
  }
  const Picker = Object.assign(
    function Picker({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) {
      return ReactModule.createElement(View, props, children);
    },
    { Item: function PickerItem() { return null; } },
  );
  return { Host, Picker };
});

describe('予定編集の基本項目', () => {
  it('ざっくり定義を単一選択dropdownで変更する', async () => {
    const base = { calendarId: 'personal-default', fadeInRatio: 0, fadeOutRatio: 0,
      isSystem: true, isEnabled: true, sortOrder: 10,
      createdAt: '2026-09-30T00:00:00.000Z', updatedAt: '2026-09-30T00:00:00.000Z' } as const;
    const definitions: TemporalDefinition[] = [
      { ...base, id: 'morning', key: 'morning', label: '朝', granularity: 'day', resolverConfig: { kind: 'timeOfDay', startMinute: 360, endMinute: 600 } },
      { ...base, id: 'next-week', key: 'next_week', label: '来週', granularity: 'week', resolverConfig: { kind: 'week', selectionWeekOffset: 1, startWeekday: 1, endWeekday: 7 } },
      { ...base, id: 'month-end', key: 'month_end', label: '月末', granularity: 'month', resolverConfig: { kind: 'monthLastDays', selectionMonthOffset: 0, count: 5 } },
    ];
    const onSelect = jest.fn();
    const view = await render(<TemporalDefinitionPicker definitions={definitions} selectedId="next-week" disabled={false} onSelect={onSelect} />);
    const picker = view.getByTestId('event-editor.temporal-definition-picker');
    expect(picker.props.selectedValue).toBe('next-week');
    await act(async () => { fireEvent(picker, 'valueChange', 'morning'); });
    expect(onSelect).toHaveBeenCalledWith('morning');
  });
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

  it('日本語の日付表示にcompact pickerを重ねて直接選択できる', async () => {
    const onStartDateChange = jest.fn();
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
      onStartDateChange={onStartDateChange}
      onStartTimeChange={jest.fn()}
      onEndDateChange={jest.fn()}
      onEndTimeChange={jest.fn()}
    />);
    expect(view.getByText('9月25日（金）')).toBeOnTheScreen();
    expect(view.getByText('9月26日（土）')).toBeOnTheScreen();
    const picker = view.getByTestId('event-editor.start-date-picker');
    expect(picker.props.display).toBe('compact');
    await act(async () => { fireEvent(picker, 'valueChange', {}, new Date(2026, 9, 2)); });
    expect(onStartDateChange).toHaveBeenCalledWith('2026-10-02');
  });
});
