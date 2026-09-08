import { render, screen } from '@testing-library/react-native';

import IndexRoute from '../index';

jest.mock('@/global.css', () => ({}));

jest.mock('expo-device', () => ({ isDevice: false }));

jest.mock('@/data/holidays/japanese-holiday-provider', () => ({
  JapaneseHolidayProvider: class JapaneseHolidayProvider {
    list() {
      return { status: 'available', holidays: [] };
    }
  },
}));

jest.mock('@/features/calendar/screens/month-calendar-screen', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    MonthCalendarScreen: ({
      holidayProvider,
      weekStartsOn,
    }: {
      holidayProvider: { constructor: { name: string } };
      weekStartsOn: number;
    }) => React.createElement(Text, null, `月画面:${holidayProvider.constructor.name}:${weekStartsOn}`),
  };
});

jest.mock('@/components/animated-icon', () => ({ AnimatedIcon: () => null }));
jest.mock('@/components/hint-row', () => ({ HintRow: () => null }));
jest.mock('@/components/themed-text', () => ({ ThemedText: () => null }));
jest.mock('@/components/themed-view', () => ({
  ThemedView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/web-badge', () => ({ WebBadge: () => null }));

describe('ホームルート', () => {
  it('日本の祝日providerと月曜始まりで月画面を組み立てる', async () => {
    await render(<IndexRoute />);

    expect(screen.getByText('月画面:JapaneseHolidayProvider:1')).toBeTruthy();
  });
});
