import { render, screen, userEvent } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import NewEventRoute from '../new';
import { useRepositories } from '@/data/sqlite/app-database-provider';
import { useCalendarRefresh } from '@/features/calendar/calendar-refresh-context';
import {
  useQuickCreateEvent,
  type QuickCreateEventState,
} from '@/features/events/hooks/use-quick-create-event';

jest.mock('@/global.css', () => ({}));
jest.mock('expo-router', () => ({ useLocalSearchParams: jest.fn(), useRouter: jest.fn() }));
jest.mock('@/data/sqlite/app-database-provider', () => ({ useRepositories: jest.fn() }));
jest.mock('@/features/calendar/calendar-refresh-context', () => ({ useCalendarRefresh: jest.fn() }));
jest.mock('@/features/events/hooks/use-quick-create-event', () => ({ useQuickCreateEvent: jest.fn() }));
jest.mock('@/features/events/screens/quick-create-event-screen', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    QuickCreateEventScreen: ({ onSave, onCancel }: { onSave(): void; onCancel(): void }) =>
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
    jest.mocked(useQuickCreateEvent).mockReturnValue({ save } as unknown as QuickCreateEventState);

    await render(<NewEventRoute />);

    expect(useQuickCreateEvent).toHaveBeenCalledWith({
      calendars: repositories.calendars,
      events: repositories.events,
      temporalDefinitions: repositories.temporalDefinitions,
      initialDate: '2026-09-21',
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
    jest.mocked(useQuickCreateEvent).mockReturnValue({
      save: jest.fn().mockResolvedValue(false),
    } as unknown as QuickCreateEventState);

    await render(<NewEventRoute />);
    await user.press(screen.getByRole('button', { name: '保存' }));

    expect(notifyChanged).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });
});
