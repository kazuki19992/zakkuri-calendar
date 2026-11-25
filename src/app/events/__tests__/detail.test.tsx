import { Alert } from 'react-native';
import { useEventEditor } from '@/features/events/hooks/use-event-editor';
import { act, render, screen, userEvent } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import EventDetailRoute from '../detail/[id]';
import { useRepositories } from '@/data/sqlite/app-database-provider';
import { useCalendarRefresh } from '@/features/calendar/calendar-refresh-context';
import { useEventDetails } from '@/features/events/hooks/use-event-details';

jest.mock('@/global.css', () => ({}));
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: 'series', occurrenceDate: '2026-12-01' }),
  useRouter: jest.fn(),
}));
jest.mock('@/data/sqlite/app-database-provider', () => ({ useRepositories: jest.fn() }));
jest.mock('@/features/calendar/calendar-refresh-context', () => ({ useCalendarRefresh: jest.fn() }));
jest.mock('@/features/events/hooks/use-event-details', () => ({ useEventDetails: jest.fn() }));

jest.mock('@/features/events/hooks/use-event-editor', () => ({ useEventEditor: jest.fn() }));

const back = jest.fn();
const replace = jest.fn();
const remove = jest.fn().mockResolvedValue(true);
const notifyChanged = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useRouter).mockReturnValue({ back, replace } as unknown as ReturnType<typeof useRouter>);
  jest.mocked(useRepositories).mockReturnValue({} as ReturnType<typeof useRepositories>);
  jest.mocked(useCalendarRefresh).mockReturnValue({ revision: 1, notifyChanged });
  jest.mocked(useEventEditor).mockReturnValue({
    status: 'ready', isBusy: false, scopeRequest: null, remove,
  } as unknown as ReturnType<typeof useEventEditor>);
  jest.mocked(useEventDetails).mockReturnValue({
    status: 'ready',
    details: {
      title: '歯医者', timeLabel: '12月1日（火）　夕方',
      location: '駅前', note: '保険証を持参', recurring: true,
      reminders: [{ id: 'r', dateTime: '12月1日（火） 18:00', condition: '終了1時間前' }],
    },
    retry: jest.fn(),
  });
});

test('発生回の時間帯名と通知日時を確認し、同じ発生回の編集で詳細を置き換える', async () => {
  await render(<EventDetailRoute />);

  expect(screen.getByText('歯医者')).toBeOnTheScreen();
  expect(screen.getByText('12月1日（火）　夕方')).toBeOnTheScreen();
  expect(screen.getByText('12月1日（火） 18:00')).toBeOnTheScreen();
  expect(screen.getByText('保険証を持参')).toBeOnTheScreen();
  await userEvent.setup().press(screen.getByRole('button', { name: '編集' }));
  expect(replace).toHaveBeenCalledWith({
    pathname: '/events/[id]', params: { id: 'series', occurrenceDate: '2026-12-01' },
  });
});

test('閉じるボタンでカレンダーに戻る', async () => {
  await render(<EventDetailRoute />);
  await userEvent.setup().press(screen.getByRole('button', { name: '閉じる' }));
  expect(back).toHaveBeenCalledTimes(1);
});

test('詳細から削除を確認し、成功した場合にカレンダーへ戻る', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  try {
    await render(<EventDetailRoute />);
    await userEvent.setup().press(screen.getByRole('button', { name: '繰り返し予定を削除' }));
    expect(remove).not.toHaveBeenCalled();
    await act(async () => alert.mock.calls[0][2]?.[1].onPress?.());
    expect(remove).toHaveBeenCalledTimes(1);
    expect(notifyChanged).toHaveBeenCalledTimes(1);
    expect(back).toHaveBeenCalledTimes(1);
  } finally {
    alert.mockRestore();
  }
});
