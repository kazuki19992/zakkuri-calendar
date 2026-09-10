import { render, screen, userEvent } from '@testing-library/react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { BackHandler } from 'react-native';
import NewEventRoute from '../new';
import { useRepositories } from '@/data/sqlite/app-database-provider';
import { useCalendarRefresh } from '@/features/calendar/calendar-refresh-context';
import {
  useEventEditor,
  type EventEditorState,
} from '@/features/events/hooks/use-event-editor';

jest.mock('@/global.css', () => ({}));
jest.mock('expo-router', () => ({
  Stack: { Screen: jest.fn(() => null) },
  useLocalSearchParams: jest.fn(),
  useRouter: jest.fn(),
}));
jest.mock('@/data/sqlite/app-database-provider', () => ({ useRepositories: jest.fn() }));
jest.mock('@/features/calendar/calendar-refresh-context', () => ({ useCalendarRefresh: jest.fn() }));
jest.mock('@/features/events/hooks/use-event-editor', () => ({ useEventEditor: jest.fn() }));
jest.mock('@/features/events/screens/event-editor-screen', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    EventEditorScreen: ({ onSave, onCancel }: { onSave(): void; onCancel(): void }) =>
      React.createElement(
        View,
        null,
        React.createElement(
          Pressable,
          { accessibilityRole: 'button', accessibilityLabel: '保存', onPress: onSave },
          React.createElement(Text, null, '保存'),
        ),
        React.createElement(
          Pressable,
          { accessibilityRole: 'button', accessibilityLabel: 'キャンセル', onPress: onCancel },
          React.createElement(Text, null, 'キャンセル'),
        ),
      ),
  };
});

describe('予定作成ルート', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('選択日とRepositoryをフックへ渡し保存成功後に月表示へ戻る', async () => {
    const user = userEvent.setup();
    const repositories = {
      calendars: { getDefault: jest.fn() },
      events: { create: jest.fn() },
      temporalDefinitions: { listEnabled: jest.fn() },
    };
    const back = jest.fn();
    const notifyChanged = jest.fn();
    const save = jest.fn().mockResolvedValue(true);
    jest.mocked(useLocalSearchParams).mockReturnValue({ date: '2026-09-21' });
    jest.mocked(useRouter).mockReturnValue({ back } as unknown as ReturnType<typeof useRouter>);
    jest
      .mocked(useRepositories)
      .mockReturnValue(repositories as unknown as ReturnType<typeof useRepositories>);
    jest.mocked(useCalendarRefresh).mockReturnValue({ revision: 0, notifyChanged });
    jest.mocked(useEventEditor).mockReturnValue({ save } as unknown as EventEditorState);

    await render(<NewEventRoute />);

    expect(useEventEditor).toHaveBeenCalledWith({
      calendars: repositories.calendars,
      events: repositories.events,
      temporalDefinitions: repositories.temporalDefinitions,
      initial: expect.objectContaining({
        date: '2026-09-21',
        temporalType: 'exact',
      }),
    });
    await user.press(screen.getByRole('button', { name: '保存' }));
    expect(notifyChanged).toHaveBeenCalledTimes(1);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('保存失敗時は作成画面を閉じない', async () => {
    const user = userEvent.setup();
    const back = jest.fn();
    const notifyChanged = jest.fn();
    jest.mocked(useLocalSearchParams).mockReturnValue({ date: '2026-09-21' });
    jest.mocked(useRouter).mockReturnValue({ back } as unknown as ReturnType<typeof useRouter>);
    jest.mocked(useRepositories).mockReturnValue({
      calendars: {},
      events: {},
      temporalDefinitions: {},
    } as ReturnType<typeof useRepositories>);
    jest.mocked(useCalendarRefresh).mockReturnValue({ revision: 0, notifyChanged });
    jest.mocked(useEventEditor).mockReturnValue({
      save: jest.fn().mockResolvedValue(false),
    } as unknown as EventEditorState);

    await render(<NewEventRoute />);
    await user.press(screen.getByRole('button', { name: '保存' }));

    expect(notifyChanged).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });

  it('日付指定がない場合も4桁年の今日を初期値にする', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(999, 8, 9, 12));
    jest.mocked(useLocalSearchParams).mockReturnValue({});
    jest.mocked(useRouter).mockReturnValue({ back: jest.fn() } as unknown as ReturnType<
      typeof useRouter
    >);
    jest.mocked(useRepositories).mockReturnValue({
      calendars: {},
      events: {},
      temporalDefinitions: {},
    } as ReturnType<typeof useRepositories>);
    jest.mocked(useCalendarRefresh).mockReturnValue({ revision: 0, notifyChanged: jest.fn() });
    jest.mocked(useEventEditor).mockReturnValue({
      isSaving: false,
      isDeleting: false,
      save: jest.fn(),
    } as unknown as EventEditorState);

    await render(<NewEventRoute />);

    expect(useEventEditor).toHaveBeenCalledWith(expect.objectContaining({
      initial: expect.objectContaining({ date: '0999-09-09' }),
    }));
  });

  it('保存中はモーダルのスワイプとAndroidの戻る操作を無効にする', async () => {
    const remove = jest.fn();
    const addBackHandler = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockReturnValue({ remove });
    jest.mocked(useLocalSearchParams).mockReturnValue({ date: '2026-09-21' });
    jest.mocked(useRouter).mockReturnValue({ back: jest.fn() } as unknown as ReturnType<
      typeof useRouter
    >);
    jest.mocked(useRepositories).mockReturnValue({
      calendars: {},
      events: {},
      temporalDefinitions: {},
    } as ReturnType<typeof useRepositories>);
    jest.mocked(useCalendarRefresh).mockReturnValue({ revision: 0, notifyChanged: jest.fn() });
    jest.mocked(useEventEditor).mockReturnValue({
      isSaving: true,
      isDeleting: false,
      save: jest.fn(),
    } as unknown as EventEditorState);

    const view = await render(<NewEventRoute />);

    expect(jest.mocked(Stack.Screen)).toHaveBeenCalledWith(
      expect.objectContaining({ options: { gestureEnabled: false } }),
      undefined,
    );
    const backHandler = addBackHandler.mock.calls[0]?.[1];
    expect(backHandler?.({ type: 'hardwareBackPress', timeStamp: 0 })).toBe(true);

    await view.unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
