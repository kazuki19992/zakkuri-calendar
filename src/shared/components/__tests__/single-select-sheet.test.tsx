import { act, fireEvent, render, userEvent } from '@testing-library/react-native';
import { Animated, StyleSheet } from 'react-native';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { SingleSelectSheet } from '../single-select-sheet';

jest.mock('@/global.css', () => ({}));
jest.mock('@/hooks/use-reduce-motion', () => ({ useReduceMotion: jest.fn(() => false) }));

const options = [
  { value: 'morning', label: '朝', group: 'この日' },
  { value: 'this-week', label: '今週中', group: '週単位' },
] as const;

type RenderResult = Awaited<ReturnType<typeof render>>;

const closeActions: readonly [string, (view: RenderResult) => void][] = [
  ['背景', (view) => fireEvent.press(view.getByTestId(
    'single-select-sheet.backdrop', { includeHiddenElements: true },
  ))],
  ['取消', (view) => fireEvent.press(view.getByLabelText('キャンセル'))],
  ['Android back', (view) => fireEvent(
    view.getByTestId('single-select-sheet.modal'), 'requestClose',
  )],
];

describe('共通の単一選択シート', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.mocked(useReduceMotion).mockReturnValue(false);
  });

  it('groupと現在値を示し、選択した値を返して閉じる', async () => {
    jest.mocked(useReduceMotion).mockReturnValue(true);
    const user = userEvent.setup();
    const onSelect = jest.fn();
    const onClose = jest.fn();
    const view = await render(
      <SingleSelectSheet visible title="時間帯" value="morning" options={options}
        onSelect={onSelect} onClose={onClose} />,
    );

    expect(view.getByText('この日')).toBeOnTheScreen();
    expect(view.getByText('週単位')).toBeOnTheScreen();
    expect(view.getByLabelText('朝、この日、選択中').props.accessibilityState)
      .toMatchObject({ selected: true });

    await user.press(view.getByLabelText('今週中、週単位'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('this-week');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each(closeActions)('%sは値を変えず一度だけ閉じる', async (_label, action) => {
    jest.mocked(useReduceMotion).mockReturnValue(true);
    const onSelect = jest.fn();
    const onClose = jest.fn();
    const view = await render(
      <SingleSelectSheet visible title="時間帯" value="morning" options={options}
        onSelect={onSelect} onClose={onClose} />,
    );
    const backdrop = view.getByTestId(
      'single-select-sheet.backdrop', { includeHiddenElements: true },
    );
    expect(backdrop.props).toMatchObject({ accessible: false, importantForAccessibility: 'no' });

    action(view);

    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('選択肢が空、または現在値が候補にない場合も安全に表示する', async () => {
    const empty = await render(
      <SingleSelectSheet visible title="時間帯" value="unknown" options={[]}
        onSelect={jest.fn()} onClose={jest.fn()} />,
    );
    expect(empty.getByText('選択肢がありません')).toBeOnTheScreen();

    const unknown = await render(
      <SingleSelectSheet visible title="時間帯" value="unknown" options={options}
        onSelect={jest.fn()} onClose={jest.fn()} />,
    );
    expect(unknown.getByLabelText('朝、この日').props.accessibilityState)
      .toMatchObject({ selected: false });
    expect(unknown.getByLabelText('今週中、週単位').props.accessibilityState)
      .toMatchObject({ selected: false });
  });

  it('disabledでは選択できず、操作領域を44pt以上にする', async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    const view = await render(
      <SingleSelectSheet visible title="時間帯" value="morning" options={options} disabled
        onSelect={onSelect} onClose={jest.fn()} />,
    );
    const option = view.getByLabelText('今週中、週単位');

    expect(option.props.accessibilityState).toMatchObject({ disabled: true, selected: false });
    expect(StyleSheet.flatten(option.props.style).minHeight).toBeGreaterThanOrEqual(44);
    await user.press(option);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('同じ名称の候補もvalueとgroupで別々に扱う', async () => {
    const duplicateOptions = [
      { value: 'day', label: '後半', group: 'この日' },
      { value: 'week', label: '後半', group: '週単位' },
    ] as const;
    const view = await render(
      <SingleSelectSheet visible title="時間帯" value="week" options={duplicateOptions}
        onSelect={jest.fn()} onClose={jest.fn()} />,
    );

    expect(view.getByLabelText('後半、この日').props.accessibilityState.selected).toBe(false);
    expect(view.getByLabelText('後半、週単位、選択中').props.accessibilityState.selected).toBe(true);
  });

  it('背景はフェードし、シートだけを短い距離で上下させる', async () => {
    const onClose = jest.fn();
    const timing = jest.spyOn(Animated, 'timing').mockImplementation((_value, config) => ({
      start: (callback?: Animated.EndCallback) => callback?.({ finished: true }),
      stop: jest.fn(),
      reset: jest.fn(),
      _config: config,
    }) as unknown as Animated.CompositeAnimation);
    const view = await render(
      <SingleSelectSheet visible title="時間帯" value="morning" options={options}
        onSelect={jest.fn()} onClose={onClose} />,
    );

    expect(view.getByTestId('single-select-sheet.modal').props.animationType).toBe('none');
    expect(StyleSheet.flatten(view.getByTestId('single-select-sheet.backdrop-shade', {
      includeHiddenElements: true,
    }).props.style)
      .opacity).toBe(0);
    expect(StyleSheet.flatten(view.getByTestId('single-select-sheet.sheet', {
      includeHiddenElements: true,
    }).props.style)
      .transform).toEqual([{ translateY: 16 }]);
    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }));

    timing.mockClear();
    fireEvent.press(view.getByTestId('single-select-sheet.backdrop', {
      includeHiddenElements: true,
    }));
    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }));
    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      toValue: 16,
      duration: 180,
      useNativeDriver: true,
    }));
    expect(onClose).toHaveBeenCalledTimes(1);
    timing.mockRestore();
  });

  it('Reduce Motion有効時は初期描画から最終位置を使う', async () => {
    jest.mocked(useReduceMotion).mockReturnValue(true);

    const view = await render(
      <SingleSelectSheet visible title="時間帯" value="morning" options={options}
        onSelect={jest.fn()} onClose={jest.fn()} />,
    );

    expect(StyleSheet.flatten(view.getByTestId('single-select-sheet.backdrop-shade', {
      includeHiddenElements: true,
    }).props.style).opacity).toBe(1);
    expect(StyleSheet.flatten(view.getByTestId('single-select-sheet.sheet', {
      includeHiddenElements: true,
    }).props.style).transform).toEqual([{ translateY: 0 }]);
  });

  it('閉じる遷移中の連続選択は最初の一回だけ受け付ける', async () => {
    const animationCallbacks: (Animated.EndCallback | undefined)[] = [];
    jest.spyOn(Animated, 'parallel').mockImplementation(() => ({
      start: (callback?: Animated.EndCallback) => animationCallbacks.push(callback),
      stop: jest.fn(),
      reset: jest.fn(),
    }) as unknown as Animated.CompositeAnimation);
    const onSelect = jest.fn();
    const onClose = jest.fn();
    const view = await render(
      <SingleSelectSheet visible title="時間帯" value="morning" options={options}
        onSelect={onSelect} onClose={onClose} />,
    );

    await fireEvent.press(view.getByLabelText('今週中、週単位'));
    await fireEvent.press(view.getByLabelText('朝、この日、選択中'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('this-week');
    expect(onClose).not.toHaveBeenCalled();
    await act(() => animationCallbacks.at(-1)?.({ finished: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('閉じる遷移中にReduce Motionが有効になっても閉じる要求を完了する', async () => {
    let reduceMotion = false;
    jest.mocked(useReduceMotion).mockImplementation(() => reduceMotion);
    const animationCallbacks: (Animated.EndCallback | undefined)[] = [];
    jest.spyOn(Animated, 'parallel').mockImplementation(() => ({
      start: (callback?: Animated.EndCallback) => animationCallbacks.push(callback),
      stop: jest.fn(),
      reset: jest.fn(),
    }) as unknown as Animated.CompositeAnimation);
    const onClose = jest.fn();
    const props = {
      visible: true,
      title: '時間帯',
      value: 'morning' as const,
      options,
      onSelect: jest.fn(),
      onClose,
    };
    const view = await render(<SingleSelectSheet {...props} />);

    await fireEvent.press(view.getByTestId(
      'single-select-sheet.backdrop', { includeHiddenElements: true },
    ));
    expect(onClose).not.toHaveBeenCalled();

    reduceMotion = true;
    await view.rerender(<SingleSelectSheet {...props} />);

    expect(onClose).toHaveBeenCalledTimes(1);
    await act(() => animationCallbacks.at(-1)?.({ finished: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
