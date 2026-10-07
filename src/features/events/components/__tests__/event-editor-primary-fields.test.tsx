import { act, fireEvent, render, userEvent } from '@testing-library/react-native';
import { Animated, StyleSheet, Text } from 'react-native';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { EventDateTimeFields } from '../event-date-time-fields';
import { EventEditorHeader } from '../event-editor-header';
import { EventEditorTabContent } from '../event-editor-tab-content';
import { EventEditorTabs } from '../event-editor-tabs';
import { TemporalDefinitionPicker } from '../temporal-definition-picker';
import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';

jest.mock('@/global.css', () => ({}));
jest.mock('@/hooks/use-reduce-motion', () => ({ useReduceMotion: jest.fn(() => false) }));
jest.mock('@expo/ui/community/datetime-picker', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { __esModule: true, default: View };
});

describe('予定編集の基本項目', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.mocked(useReduceMotion).mockReturnValue(false);
  });

  it('ざっくり定義を単一選択dropdownで変更する', async () => {
    const user = userEvent.setup();
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
    await user.press(view.getByLabelText('時間帯、来週、選択する'));
    expect(view.getByText('この日')).toBeOnTheScreen();
    expect(view.getByText('週単位')).toBeOnTheScreen();
    expect(view.getByText('月単位')).toBeOnTheScreen();
    await user.press(view.getByLabelText('朝、この日'));
    expect(onSelect).toHaveBeenCalledWith('morning');
  });

  it('時間帯が空なら説明し、未知の現在値は先頭候補へfallbackする', async () => {
    const base = { calendarId: 'personal-default', fadeInRatio: 0, fadeOutRatio: 0,
      isSystem: true, isEnabled: true, sortOrder: 10,
      createdAt: '2026-09-30T00:00:00.000Z', updatedAt: '2026-09-30T00:00:00.000Z' } as const;
    const definitions: TemporalDefinition[] = [
      { ...base, id: 'morning', key: 'morning', label: '朝', granularity: 'day', resolverConfig: { kind: 'timeOfDay', startMinute: 360, endMinute: 600 } },
    ];
    const view = await render(<TemporalDefinitionPicker definitions={[]} selectedId={null}
      disabled={false} onSelect={jest.fn()} />);
    expect(view.getByText('利用できる時間帯がありません')).toBeOnTheScreen();

    await view.rerender(<TemporalDefinitionPicker definitions={definitions} selectedId="missing"
      disabled={false} onSelect={jest.fn()} />);
    expect(view.getByLabelText('時間帯、朝、選択する')).toBeOnTheScreen();
  });
  it('中央タイトルと同じ幅の左右操作を表示する', async () => {
    const view = await render(<EventEditorHeader mode="create" busy={false} ready onCancel={jest.fn()} onSave={jest.fn()} />);
    expect(view.getByText('予定を追加')).toBeOnTheScreen();
    expect(view.getByLabelText('キャンセル').parent?.props.style).toEqual(view.getByLabelText('保存').parent?.props.style);
    expect(StyleSheet.flatten(view.getByText('予定を追加').parent?.props.style).paddingHorizontal)
      .toBe(16);
  });

  it('2つのタブに選択状態を付ける', async () => {
    const onChange = jest.fn();
    const view = await render(<EventEditorTabs value="fuzzy" disabled={false} onChange={onChange} />);
    expect(view.getByLabelText('ざっくり').props.accessibilityState).toMatchObject({ selected: true });
    expect(view.getByLabelText('きっちり').props.accessibilityState).toMatchObject({ selected: false });
    fireEvent.press(view.getByLabelText('きっちり'));
    expect(onChange).toHaveBeenCalledWith('exact');
  });

  it('タブindicatorを通常時は180ms、Reduce Motion時は即時に移動する', async () => {
    const timing = jest.spyOn(Animated, 'timing').mockReturnValue({
      start: jest.fn(), stop: jest.fn(), reset: jest.fn(),
    } as unknown as Animated.CompositeAnimation);
    jest.mocked(useReduceMotion).mockReturnValue(false);
    const view = await render(<EventEditorTabs value="fuzzy" disabled={false} onChange={jest.fn()} />);
    timing.mockClear();

    await view.rerender(<EventEditorTabs value="exact" disabled={false} onChange={jest.fn()} />);
    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      toValue: 1, duration: 180, useNativeDriver: true,
    }));

    jest.mocked(useReduceMotion).mockReturnValue(true);
    timing.mockClear();
    await view.rerender(<EventEditorTabs value="fuzzy" disabled={false} onChange={jest.fn()} />);
    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ duration: 0 }));
    timing.mockRestore();
    jest.mocked(useReduceMotion).mockReturnValue(false);
  });

  it('タブ内容を切替方向から入れ、古い完了callbackへ表示stateを持たせない', async () => {
    const setValue = jest.spyOn(Animated.Value.prototype, 'setValue');
    const timing = jest.spyOn(Animated, 'timing').mockReturnValue({
      start: jest.fn(), stop: jest.fn(), reset: jest.fn(),
    } as unknown as Animated.CompositeAnimation);
    const view = await render(<EventEditorTabContent tab="fuzzy"><Text>内容</Text></EventEditorTabContent>);

    setValue.mockClear();
    await view.rerender(<EventEditorTabContent tab="exact"><Text>内容</Text></EventEditorTabContent>);
    expect(setValue).toHaveBeenCalledWith(-12);
    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      toValue: 0, duration: 180, useNativeDriver: true,
    }));

    timing.mockClear();
    setValue.mockClear();
    await view.rerender(<EventEditorTabContent tab="fuzzy"><Text>内容</Text></EventEditorTabContent>);
    expect(setValue).toHaveBeenCalledWith(12);
    expect(timing.mock.results.every((result) => {
      const animation = result.value as Animated.CompositeAnimation;
      return jest.mocked(animation.start).mock.calls.every((call) => call.length === 0);
    })).toBe(true);
    timing.mockRestore();
    setValue.mockRestore();
  });

  it('内容のanimation中にReduce Motionが有効になれば同じタブでも即時完了する', async () => {
    const stopAnimation = jest.spyOn(Animated.Value.prototype, 'stopAnimation');
    const setValue = jest.spyOn(Animated.Value.prototype, 'setValue');
    const timing = jest.spyOn(Animated, 'timing').mockReturnValue({
      start: jest.fn(), stop: jest.fn(), reset: jest.fn(),
    } as unknown as Animated.CompositeAnimation);
    jest.mocked(useReduceMotion).mockReturnValue(false);
    const view = await render(<EventEditorTabContent tab="fuzzy"><Text>内容</Text></EventEditorTabContent>);
    await view.rerender(<EventEditorTabContent tab="exact"><Text>内容</Text></EventEditorTabContent>);

    stopAnimation.mockClear();
    setValue.mockClear();
    timing.mockClear();
    jest.mocked(useReduceMotion).mockReturnValue(true);
    await view.rerender(<EventEditorTabContent tab="exact"><Text>内容</Text></EventEditorTabContent>);

    expect(stopAnimation).toHaveBeenCalledTimes(2);
    expect(setValue).toHaveBeenCalledWith(0);
    expect(setValue).toHaveBeenCalledWith(1);
    expect(timing).not.toHaveBeenCalled();
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
