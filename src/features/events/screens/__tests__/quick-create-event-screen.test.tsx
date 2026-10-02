import { act, fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';
import type { QuickCreateEventState } from '../../hooks/use-quick-create-event';
import { QuickCreateEventScreen } from '../quick-create-event-screen';

jest.mock('@/global.css', () => ({}));
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

const morning: TemporalDefinition = {
  id: 'personal-default:morning',
  calendarId: 'personal-default',
  key: 'morning',
  label: '朝',
  granularity: 'day',
  resolverConfig: { kind: 'timeOfDay', startMinute: 360, endMinute: 720 },
  fadeInRatio: 0.2,
  fadeOutRatio: 0.2,
  isSystem: true,
  isEnabled: true,
  sortOrder: 1,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const afternoon: TemporalDefinition = {
  ...morning,
  id: 'personal-default:afternoon',
  key: 'afternoon',
  label: '午後',
  sortOrder: 2,
};

const callbacks = {
  setTitle: jest.fn(),
  setAnchorDate: jest.fn(),
  selectDefinition: jest.fn(),
  retry: jest.fn(),
  save: jest.fn().mockResolvedValue(true),
};

function createState(overrides: Partial<QuickCreateEventState> = {}): QuickCreateEventState {
  return {
    status: 'ready',
    title: '',
    anchorDate: '2026-09-09',
    definitions: [morning, afternoon],
    selectedDefinitionId: morning.id,
    titleError: null,
    anchorDateError: null,
    saveError: null,
    isSaving: false,
    ...callbacks,
    ...overrides,
  };
}

describe('ざっくり予定作成画面', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('タイトルと日付とDB由来の時間帯を入力して保存できる', async () => {
    const onSave = jest.fn();
    const onCancel = jest.fn();
    const user = userEvent.setup();
    await render(
      <QuickCreateEventScreen state={createState()} onSave={onSave} onCancel={onCancel} />,
    );

    await user.type(screen.getByLabelText('タイトル'), '散歩');
    await user.clear(screen.getByLabelText('日付'));
    await user.type(screen.getByLabelText('日付'), '2026-09-10');
    const picker = screen.getByTestId('event-editor.temporal-definition-picker');
    await act(async () => { fireEvent(picker, 'valueChange', afternoon.id); });
    await user.press(screen.getByRole('button', { name: '保存' }));
    await user.press(screen.getByRole('button', { name: 'キャンセル' }));

    expect(callbacks.setTitle).toHaveBeenCalled();
    expect(callbacks.setAnchorDate).toHaveBeenCalled();
    expect(callbacks.selectDefinition).toHaveBeenCalledWith(afternoon.id);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(picker.props).toMatchObject({ enabled: true, selectedValue: morning.id });
    expect(screen.getAllByText('時間帯')).toHaveLength(1);
  });

  it('入力エラーと保存エラーを表示する', async () => {
    await render(
      <QuickCreateEventScreen
        state={createState({
          titleError: 'タイトルを入力してください',
          anchorDateError: '日付をYYYY-MM-DD形式で入力してください',
          saveError: '保存できませんでした。もう一度お試しください。',
        })}
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.getByText('タイトルを入力してください')).toBeTruthy();
    expect(screen.getByText('日付をYYYY-MM-DD形式で入力してください')).toBeTruthy();
    expect(screen.getByText('保存できませんでした。もう一度お試しください。')).toBeTruthy();
  });

  it('保存中は保存操作を無効にする', async () => {
    const onCancel = jest.fn();
    const user = userEvent.setup();
    await render(
      <QuickCreateEventScreen
        state={createState({ isSaving: true })}
        onSave={jest.fn()}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole('button', { name: '保存中' }).props.accessibilityState).toEqual({
      disabled: true,
    });
    expect(screen.getByLabelText('タイトル').props.editable).toBe(false);
    expect(screen.getByLabelText('日付').props.editable).toBe(false);
    expect(screen.getByTestId('event-editor.temporal-definition-picker').props)
      .toMatchObject({ enabled: false, selectedValue: morning.id });
    expect(screen.getByRole('button', { name: 'キャンセル' }).props.accessibilityState).toEqual({
      disabled: true,
    });
    await user.press(screen.getByRole('button', { name: 'キャンセル' }));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('時間帯がない場合は保存せず案内を表示する', async () => {
    await render(
      <QuickCreateEventScreen
        state={createState({ definitions: [], selectedDefinitionId: null })}
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.getByText('利用できる時間帯がありません')).toBeTruthy();
    expect(screen.getByRole('button', { name: '保存' }).props.accessibilityState).toEqual({
      disabled: true,
    });
  });

  it('読み込み失敗時に再試行できる', async () => {
    const user = userEvent.setup();
    await render(
      <QuickCreateEventScreen
        state={createState({ status: 'error' })}
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.getByText('時間帯を読み込めませんでした')).toBeTruthy();
    await user.press(screen.getByRole('button', { name: '再試行' }));
    expect(callbacks.retry).toHaveBeenCalledTimes(1);
  });
});
