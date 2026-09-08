import { render, screen, userEvent } from '@testing-library/react-native';

import { MonthCalendarScreen } from '../month-calendar-screen';
import { useRepositories } from '@/data/sqlite/app-database-provider';
import { useMonthCalendar, type MonthCalendarState } from '../../hooks/use-month-calendar';

jest.mock('@/global.css', () => ({}));

jest.mock('@/data/sqlite/app-database-provider', () => ({
  useRepositories: jest.fn(),
}));

jest.mock('../../hooks/use-month-calendar', () => ({
  useMonthCalendar: jest.fn(),
}));

jest.mock('../../components/month-grid', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    MonthGrid: (props: {
      visibleMonth: string;
      days: readonly { date: string }[];
      onSelectDate(date: string): void;
      onVisibleMonthChange?(date: string): void;
      onPreviousMonth(): void;
      onToday(): void;
      onNextMonth(): void;
    }) =>
      React.createElement(
        View,
        null,
        React.createElement(Text, null, `月グリッド:${props.visibleMonth}`),
        React.createElement(Text, null, `日付モデル:${props.days.map((day) => day.date).join(',')}`),
        React.createElement(
          Text,
          null,
          `月変更通知:${props.onVisibleMonthChange === undefined ? 'なし' : 'あり'}`,
        ),
        React.createElement(
          Pressable,
          { accessibilityRole: 'button', accessibilityLabel: '日付選択', onPress: () => props.onSelectDate('2026-09-22') },
          React.createElement(Text, null, '日付選択'),
        ),
        React.createElement(
          Pressable,
          { accessibilityRole: 'button', accessibilityLabel: '前月', onPress: props.onPreviousMonth },
          React.createElement(Text, null, '前月'),
        ),
        React.createElement(
          Pressable,
          { accessibilityRole: 'button', accessibilityLabel: '今日', onPress: props.onToday },
          React.createElement(Text, null, '今日'),
        ),
        React.createElement(
          Pressable,
          { accessibilityRole: 'button', accessibilityLabel: '次月', onPress: props.onNextMonth },
          React.createElement(Text, null, '次月'),
        ),
      ),
  };
});

jest.mock('../../components/selected-day-agenda', () => ({
  SelectedDayAgenda: (props: {
    selectedDate: string;
    holidayName: string | null;
    holidaySupport: 'available' | 'unsupported';
    items: readonly { id: string; title: string }[];
  }) => {
    const React = jest.requireActual<typeof import('react')>('react');
    const { Text, View } = jest.requireActual<typeof import('react-native')>('react-native');
    return React.createElement(
      View,
      null,
      React.createElement(Text, null, `予定日:${props.selectedDate}`),
      React.createElement(Text, null, `祝日:${props.holidayName ?? 'なし'}:${props.holidaySupport}`),
      ...props.items.map((item) => React.createElement(Text, { key: item.id }, item.title)),
    );
  },
}));

const mockUseRepositories = jest.mocked(useRepositories);
const mockUseMonthCalendar = jest.mocked(useMonthCalendar);

const repositoryContainer = {
  calendars: { getDefault: jest.fn() },
  events: { listByAnchorRange: jest.fn(), create: jest.fn(), getById: jest.fn(), update: jest.fn(), delete: jest.fn() },
  temporalDefinitions: { listEnabled: jest.fn(), getById: jest.fn(), disable: jest.fn() },
  settings: {
    getDefaultExactDuration: jest.fn(),
    setDefaultExactDuration: jest.fn(),
    getUndeterminedFadeMinutes: jest.fn(),
  },
};

const stateCallbacks = {
  showPreviousMonth: jest.fn(),
  showNextMonth: jest.fn(),
  showToday: jest.fn(),
  selectDate: jest.fn(),
  retry: jest.fn(),
};

function createState(overrides: Partial<MonthCalendarState> = {}): MonthCalendarState {
  return {
    status: 'ready',
    visibleMonth: '2026-09-01',
    selectedDate: '2026-09-21',
    today: '2026-09-08',
    days: [],
    agendaItems: [],
    selectedHolidayName: '敬老の日',
    holidaySupport: 'available',
    ...stateCallbacks,
    ...overrides,
  };
}

describe('月カレンダー画面', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRepositories.mockReturnValue(repositoryContainer);
  });

  it('読み込み中はカレンダー操作を表示しない', async () => {
    mockUseMonthCalendar.mockReturnValue(createState({ status: 'loading' }));

    await render(<MonthCalendarScreen holidayProvider={{ list: jest.fn() }} weekStartsOn={1} />);

    expect(screen.getByLabelText('カレンダーを読み込んでいます')).toBeTruthy();
    expect(screen.queryByText('月グリッド:2026-09-01')).toBeNull();
  });

  it('読み込みエラー時は再試行操作を表示する', async () => {
    mockUseMonthCalendar.mockReturnValue(createState({ status: 'error' }));

    await render(<MonthCalendarScreen holidayProvider={{ list: jest.fn() }} weekStartsOn={1} />);

    expect(screen.getByText('データを読み込めませんでした')).toBeTruthy();
    expect(screen.getByRole('button', { name: '再試行' })).toBeTruthy();
  });

  it('予定がない準備完了時は選択日の空の予定一覧を表示する', async () => {
    mockUseMonthCalendar.mockReturnValue(createState({ selectedHolidayName: null, agendaItems: [] }));

    await render(<MonthCalendarScreen holidayProvider={{ list: jest.fn() }} weekStartsOn={1} />);

    expect(screen.getByText('月グリッド:2026-09-01')).toBeTruthy();
    expect(screen.getByText('予定日:2026-09-21')).toBeTruthy();
  });

  it('予定がある準備完了時は画面状態と操作を表示コンポーネントへ渡す', async () => {
    const user = userEvent.setup();
    const holidayProvider = { list: jest.fn() };
    const agendaItems = [
      { id: 'event-1', title: '敬老会', temporalLabel: '終日', accessibilityLabel: '敬老会、終日' },
    ];
    mockUseMonthCalendar.mockReturnValue(
      createState({
        days: [
          {
            date: '2026-09-21',
            dayNumber: 21,
            weekday: 1,
            isCurrentMonth: true,
            isToday: false,
            isSelected: true,
            hasEvents: true,
            holidayName: '敬老の日',
            accessibilityLabel: '2026年9月21日、敬老の日、選択中、予定あり',
          },
        ],
        agendaItems,
      }),
    );

    await render(<MonthCalendarScreen holidayProvider={holidayProvider} weekStartsOn={1} />);

    expect(mockUseMonthCalendar).toHaveBeenCalledWith({
      calendars: repositoryContainer.calendars,
      events: repositoryContainer.events,
      temporalDefinitions: repositoryContainer.temporalDefinitions,
      holidayProvider,
      weekStartsOn: 1,
    });
    expect(screen.getByText('月グリッド:2026-09-01')).toBeTruthy();
    expect(screen.getByText('日付モデル:2026-09-21')).toBeTruthy();
    expect(screen.getByText('月変更通知:なし')).toBeTruthy();
    expect(screen.getByText('予定日:2026-09-21')).toBeTruthy();
    expect(screen.getByText('祝日:敬老の日:available')).toBeTruthy();
    expect(screen.getByText('敬老会')).toBeTruthy();
    await user.press(screen.getByRole('button', { name: '日付選択' }));
    await user.press(screen.getByRole('button', { name: '前月' }));
    await user.press(screen.getByRole('button', { name: '今日' }));
    await user.press(screen.getByRole('button', { name: '次月' }));
    expect(stateCallbacks.selectDate).toHaveBeenCalledWith('2026-09-22');
    expect(stateCallbacks.selectDate).toHaveBeenCalledTimes(1);
    expect(stateCallbacks.showPreviousMonth).toHaveBeenCalledTimes(1);
    expect(stateCallbacks.showToday).toHaveBeenCalledTimes(1);
    expect(stateCallbacks.showNextMonth).toHaveBeenCalledTimes(1);
  });

  it('小さい画面や文字拡大と多数の予定でも末尾へ到達できる構造にする', async () => {
    const agendaItems = Array.from({ length: 30 }, (_, index) => ({
      id: `event-${index}`,
      title: `予定${index}`,
      temporalLabel: '終日',
      accessibilityLabel: `予定${index}、終日`,
    }));
    mockUseMonthCalendar.mockReturnValue(createState({ agendaItems }));

    await render(<MonthCalendarScreen holidayProvider={{ list: jest.fn() }} weekStartsOn={1} />);

    expect(screen.getByTestId('month-calendar.scroll')).toBeTruthy();
    expect(screen.getByText('予定29')).toBeTruthy();
  });
});
