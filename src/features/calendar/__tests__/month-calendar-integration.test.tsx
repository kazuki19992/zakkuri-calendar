import { act, render, userEvent, waitFor } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import type { Calendar } from '@/domain/calendar/calendar';
import type { HolidayProvider } from '@/domain/calendar/holiday';
import type {
  CalendarRepository,
  EventRepository,
  TemporalDefinitionRepository,
} from '@/domain/calendar/repositories';
import { MonthGrid } from '../components/month-grid';
import { useMonthCalendar } from '../hooks/use-month-calendar';

jest.mock('@/global.css', () => ({}));

const calendar: Calendar = {
  id: 'personal-default',
  name: 'マイカレンダー',
  timeZoneId: 'Asia/Tokyo',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

type RepositoryDoubles = Readonly<{
  calendars: jest.Mocked<CalendarRepository>;
  events: jest.Mocked<EventRepository>;
  temporalDefinitions: jest.Mocked<TemporalDefinitionRepository>;
}>;

function createRepositories(): RepositoryDoubles {
  return {
    calendars: { getDefault: jest.fn().mockResolvedValue(calendar) },
    events: {
      create: jest.fn(),
      getById: jest.fn(),
      listByAnchorRange: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      delete: jest.fn(),
    },
    temporalDefinitions: {
      listEnabled: jest.fn().mockResolvedValue([]),
      getById: jest.fn().mockResolvedValue(null),
      disable: jest.fn(),
    },
  };
}

function CalendarHarness({
  repositories,
  holidayProvider,
  now,
}: Readonly<{
  repositories: RepositoryDoubles;
  holidayProvider: HolidayProvider;
  now(): Date;
}>) {
  const state = useMonthCalendar({
    ...repositories,
    holidayProvider,
    weekStartsOn: 1,
    now,
  });

  return (
    <View>
      <Text testID="calendar-status">{state.status}</Text>
      <Text testID="selected-date">{state.selectedDate}</Text>
      {state.status === 'ready' ? (
        <MonthGrid
          visibleMonth={state.visibleMonth}
          days={state.days}
          onSelectDate={state.selectDate}
          onPreviousMonth={state.showPreviousMonth}
          onToday={state.showToday}
          onNextMonth={state.showNextMonth}
        />
      ) : null}
    </View>
  );
}

async function renderCalendar() {
  const repositories = createRepositories();
  const holidayProvider: jest.Mocked<HolidayProvider> = {
    list: jest.fn().mockReturnValue({ status: 'available', holidays: [] }),
  };
  const view = await render(
    <CalendarHarness
      repositories={repositories}
      holidayProvider={holidayProvider}
      now={() => new Date(2026, 8, 8, 12)}
    />,
  );
  await waitFor(() => expect(view.getByTestId('calendar-status')).toHaveTextContent('ready'));
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return { view, repositories };
}

describe('月カレンダーの統合操作', () => {
  it('初回表示で今日の選択を月初へ上書きしない', async () => {
    const { view } = await renderCalendar();

    expect(view.getByTestId('selected-date')).toHaveTextContent('2026-09-08');
    expect(view.getByLabelText('2026年9月8日、今日、選択中')).toBeOnTheScreen();
  });

  it('月外日を選択しても移動先の月初へ上書きしない', async () => {
    const user = userEvent.setup();
    const { view, repositories } = await renderCalendar();

    await user.press(view.getByLabelText('2026年8月31日'));
    await waitFor(() =>
      expect(repositories.events.listByAnchorRange).toHaveBeenLastCalledWith(
        calendar.id,
        '2026-08-01',
        '2026-08-31',
      ),
    );
    await waitFor(() => expect(view.getByTestId('calendar-status')).toHaveTextContent('ready'));

    expect(view.getByTestId('selected-date')).toHaveTextContent('2026-08-31');
    expect(view.getByLabelText('2026年8月31日、選択中')).toBeOnTheScreen();
  });

  it('別月から今日へ戻っても今日の選択を月初へ上書きしない', async () => {
    const user = userEvent.setup();
    const { view, repositories } = await renderCalendar();

    await user.press(view.getByRole('button', { name: '次月' }));
    await waitFor(() =>
      expect(repositories.events.listByAnchorRange).toHaveBeenLastCalledWith(
        calendar.id,
        '2026-10-01',
        '2026-10-31',
      ),
    );
    await waitFor(() => expect(view.getByTestId('calendar-status')).toHaveTextContent('ready'));
    await user.press(view.getByRole('button', { name: '今日' }));
    await waitFor(() => expect(view.getByTestId('calendar-status')).toHaveTextContent('ready'));

    expect(view.getByTestId('selected-date')).toHaveTextContent('2026-09-08');
    expect(view.getByLabelText('2026年9月8日、今日、選択中')).toBeOnTheScreen();
  });
});
