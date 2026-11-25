import { act, fireEvent, render, userEvent } from '@testing-library/react-native';
import { useState } from 'react';
import { Animated, Keyboard, StyleSheet, Text } from 'react-native';
import { Colors } from '@/constants/theme';
import { CalendarAppearanceContext } from '@/hooks/calendar-appearance-context';
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

const visualOnly = { includeHiddenElements: true };

describe('予定編集の基本項目', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.mocked(useReduceMotion).mockReturnValue(false);
  });

  it('日・週・月の種別を1シートから直接選択でき、選択中のプレビューが切り替わる', async () => {
    jest.mocked(useReduceMotion).mockReturnValue(true);
    const user = userEvent.setup();
    const base = { calendarId: 'personal-default', fadeInRatio: 0, fadeOutRatio: 0,
      isSystem: true, isEnabled: true, sortOrder: 10,
      createdAt: '2026-09-30T00:00:00.000Z', updatedAt: '2026-09-30T00:00:00.000Z' } as const;
    const definitions: TemporalDefinition[] = [
      { ...base, id: 'morning', key: 'morning', label: '朝', granularity: 'day', resolverConfig: { kind: 'timeOfDay', startMinute: 360, endMinute: 600 } },
      { ...base, id: 'am', key: 'am', label: '午前', granularity: 'day', resolverConfig: { kind: 'timeOfDay', startMinute: 480, endMinute: 720 } },
      { ...base, id: 'next-week', key: 'next_week', label: '来週', granularity: 'week', resolverConfig: { kind: 'week', selectionWeekOffset: 1, startWeekday: 1, endWeekday: 7 } },
      { ...base, id: 'month-end', key: 'month_end', label: '月末', granularity: 'month', resolverConfig: { kind: 'monthLastDays', selectionMonthOffset: 0, count: 5 } },
    ];
    function TestPicker() {
      const [selectedId, setSelectedId] = useState('next-week');
      return <TemporalDefinitionPicker definitions={definitions} selectedId={selectedId} disabled={false} onSelect={setSelectedId} />;
    }
    const view = await render(<TestPicker />);
    expect(view.queryByText('この日')).toBeNull();
    const dismiss = jest.spyOn(Keyboard, 'dismiss');
    await user.press(view.getByRole('button', { name: /ざっくり種別、来週/ }));
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(view.getByText('この日')).toBeOnTheScreen();
    expect(view.getByText('週単位')).toBeOnTheScreen();
    expect(view.getByText('月単位')).toBeOnTheScreen();
    expect(view.getByRole('button', { name: '来週、週単位、選択中', selected: true })).toBeOnTheScreen();
    expect(view.getByRole('button', { name: '月末、月単位' })).toBeOnTheScreen();
    await user.press(view.getByRole('button', { name: '朝、この日' }));

    expect(view.getByRole('button', { name: /ざっくり種別、朝/ })).toBeOnTheScreen();
    expect(view.queryByText('この日')).toBeNull();
    expect(view.queryAllByText(/\d+:\d+/)).toHaveLength(0);
    const morning = StyleSheet.flatten(view.getByTestId('event-editor.temporal-bar.morning.start', visualOnly).props.style);
    expect(morning.left).toBe('25%');
    expect(view.queryByTestId('event-editor.temporal-bar.am.start', visualOnly)).toBeNull();

    await user.press(view.getByRole('button', { name: /ざっくり種別、朝/ }));
    await user.press(view.getByRole('button', { name: '午前、この日' }));
    const am = StyleSheet.flatten(view.getByTestId('event-editor.temporal-bar.am.start', visualOnly).props.style);
    expect(parseFloat(am.left)).toBeCloseTo(33.33);
    expect(am.width).toBe(morning.width);
    expect(view.queryByTestId('event-editor.temporal-bar.morning.start', visualOnly)).toBeNull();
  });

  it('日をまたぐ時間帯を一日のバーの左右に分けて表示する', async () => {
    const definitions: TemporalDefinition[] = [{
      id: 'late-night', key: 'late_night', label: '深夜', calendarId: 'personal-default',
      granularity: 'day', resolverConfig: { kind: 'timeOfDay', startMinute: 1320, endMinute: 1560 },
      fadeInRatio: 0.25, fadeOutRatio: 0.25, isSystem: true, isEnabled: true, sortOrder: 10,
      createdAt: '2026-09-30T00:00:00.000Z', updatedAt: '2026-09-30T00:00:00.000Z',
    }];
    const view = await render(<TemporalDefinitionPicker definitions={definitions} selectedId="late-night"
      disabled={false} onSelect={jest.fn()} />);

    expect(view.getByText('翌日まで')).toBeOnTheScreen();
    const startGradient = view.getByTestId('event-editor.temporal-bar.late-night.start', visualOnly);
    const nextDayGradient = view.getByTestId('event-editor.temporal-bar.late-night.next-day', visualOnly);
    const start = StyleSheet.flatten(startGradient.props.style);
    const nextDay = StyleSheet.flatten(nextDayGradient.props.style);
    expect(parseFloat(start.left)).toBeCloseTo(91.67);
    expect(nextDay.left).toBe('0%');
    expect(start.width).toBe(nextDay.width);
    expect(parseFloat(nextDay.width)).toBeCloseTo(8.33);
    expect(startGradient.props.locations).toEqual([0, 0.5, 1]);
    expect(nextDayGradient.props.locations).toEqual([0, 0.5, 1]);
    expect(startGradient.props.colors.at(-1)).toBe(nextDayGradient.props.colors[0]);
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
    expect(view.getByRole('button', { name: /ざっくり種別、朝/ })).toBeEnabled();
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
      toValue: 1, duration: 180,
    }));

    jest.mocked(useReduceMotion).mockReturnValue(true);
    timing.mockClear();
    await view.rerender(<EventEditorTabs value="fuzzy" disabled={false} onChange={jest.fn()} />);
    expect(timing).not.toHaveBeenCalled();
    expect(view.getByRole('tab', { name: 'ざっくり', selected: true })).toBeOnTheScreen();
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

  it('タップした時刻の行直下でドラムを回すと時刻を更新し、別の時刻行で開き直せる', async () => {
    function TimeFields() {
      const [startTime, setStartTime] = useState('09:07');
      const [endTime, setEndTime] = useState('11:45');
      return <EventDateTimeFields editorTab="exact" isAllDay={false} isDateEditable disabled={false}
        startDate="2026-09-25" startTime={startTime} endDate="2026-09-25" endTime={endTime}
        onAllDayChange={jest.fn()} onStartDateChange={jest.fn()} onStartTimeChange={setStartTime}
        onEndDateChange={jest.fn()} onEndTimeChange={setEndTime} />;
    }
    const view = await render(<TimeFields />);
    const startRow = view.getByRole('button', { name: '開始時刻 09:07' });
    await fireEvent.press(startRow);
    const start = view.getByTestId('event-editor.start-time-picker');
    expect(startRow.parent).toBe(start.parent);
    expect(view.getByRole('button', { name: '7分' })).toBeSelected();
    await fireEvent(view.getByTestId('duration-wheel.hours'), 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { y: 10 * 44 } },
    });
    expect(view.getByRole('button', { name: '開始時刻 10:07' })).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: '30分' }));
    expect(view.getByRole('button', { name: '開始時刻 10:30' })).toBeOnTheScreen();

    const endRow = view.getByRole('button', { name: '終了時刻 11:45' });
    await fireEvent.press(endRow);
    expect(view.queryByTestId('event-editor.start-time-picker')).toBeNull();
    expect(endRow.parent).toBe(view.getByTestId('event-editor.end-time-picker').parent);
    await fireEvent.press(view.getByRole('button', { name: '0分' }));
    const updatedEndRow = view.getByRole('button', { name: '終了時刻 11:00' });
    await fireEvent.press(updatedEndRow);
    expect(view.queryByTestId('event-editor.end-time-picker')).toBeNull();
  });

  it('終日のトグルはアプリのアクセント変更に追随する', async () => {
    const fields = <EventDateTimeFields editorTab="fuzzy" isAllDay isDateEditable disabled={false}
      startDate="2026-09-25" startTime="09:00" endDate="2026-09-25" endTime="10:00"
      onAllDayChange={jest.fn()} onStartDateChange={jest.fn()} onStartTimeChange={jest.fn()}
      onEndDateChange={jest.fn()} onEndTimeChange={jest.fn()} />;
    const view = await render(fields);
    expect(view.getByLabelText('終日').props).toMatchObject({
      tintColor: Colors.light.calendarBorder, onTintColor: Colors.light.calendarAccent,
    });
    await view.rerender(<CalendarAppearanceContext.Provider value={{
      colorId: 'umi', isBusy: false, error: null, setColor: jest.fn(),
    }}>{fields}</CalendarAppearanceContext.Provider>);
    expect(view.getByLabelText('終日').props.onTintColor).toBe('#1060a0');
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
