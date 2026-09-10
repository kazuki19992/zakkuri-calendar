import { render, screen, userEvent } from '@testing-library/react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import EditEventRoute from '../[id]';
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
    EventEditorScreen: ({ onSave, onDelete }: { onSave(): void; onDelete(): void }) =>
      React.createElement(
        View,
        null,
        React.createElement(Pressable, { accessibilityRole: 'button', accessibilityLabel: '保存', onPress: onSave }, React.createElement(Text, null, '保存')),
        React.createElement(Pressable, { accessibilityRole: 'button', accessibilityLabel: '削除', onPress: onDelete }, React.createElement(Text, null, '削除')),
      ),
  };
});

describe('予定編集ルート', () => {
  beforeEach(() => jest.clearAllMocks());

  it('IDをフックへ渡し、保存と削除の成功後に表示を更新して閉じる', async () => {
    const user = userEvent.setup();
    const save = jest.fn().mockResolvedValue(true);
    const remove = jest.fn().mockResolvedValue(true);
    const back = jest.fn();
    const notifyChanged = jest.fn();
    const repositories = { calendars: {}, events: {}, temporalDefinitions: {} };
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'event-1' });
    jest.mocked(useRouter).mockReturnValue({ back } as unknown as ReturnType<typeof useRouter>);
    jest.mocked(useRepositories).mockReturnValue(repositories as ReturnType<typeof useRepositories>);
    jest.mocked(useCalendarRefresh).mockReturnValue({ revision: 0, notifyChanged });
    jest.mocked(useEventEditor).mockReturnValue({ save, remove } as unknown as EventEditorState);

    await render(<EditEventRoute />);

    expect(useEventEditor).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'event-1' }));
    await user.press(screen.getByRole('button', { name: '保存' }));
    await user.press(screen.getByRole('button', { name: '削除' }));
    expect(notifyChanged).toHaveBeenCalledTimes(2);
    expect(back).toHaveBeenCalledTimes(2);
    expect(jest.mocked(Stack.Screen)).toHaveBeenCalled();
  });
});
