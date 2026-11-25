import { act, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { PropsWithChildren } from 'react';
import { createDefaultCalendar } from '@/domain/calendar/calendar';
import type { PrimaryCalendarColorId } from '@/domain/calendar/calendar-color';
import { useCalendarAppearance } from '@/hooks/calendar-appearance-context';
import { useTheme } from '@/hooks/use-theme';
import { CalendarAppearanceProvider } from '../calendar-appearance-provider';

jest.mock('@/global.css', () => ({}));
jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: () => 'light' }));

const calendar = createDefaultCalendar('Asia/Tokyo', '2026-11-25T00:00:00.000Z');
const calendars = { getDefault: jest.fn().mockResolvedValue(calendar) };

function Accent() {
  const theme = useTheme();
  return <Text>{theme.calendarAccent}</Text>;
}

it('既定のまっちゃからうみへ切り替え、再マウントでも復元する', async () => {
  let stored: PrimaryCalendarColorId | null = null;
  const settings = {
    getPrimaryCalendarColor: jest.fn(async () => stored),
    setPrimaryCalendarColor: jest.fn(async (next: PrimaryCalendarColorId) => { stored = next; }),
  };
  function Wrapper({ children }: PropsWithChildren) {
    return <CalendarAppearanceProvider calendars={calendars} settings={settings}>{children}</CalendarAppearanceProvider>;
  }
  const hook = await renderHook(useCalendarAppearance, { wrapper: Wrapper });
  await waitFor(() => expect(hook.result.current?.isBusy).toBe(false));
  expect(hook.result.current?.colorId).toBe('matcha');
  await act(async () => { expect(await hook.result.current?.setColor('umi')).toBe(true); });
  expect(hook.result.current?.colorId).toBe('umi');
  await hook.unmount();
  await render(<Wrapper><Accent /></Wrapper>);
  await waitFor(() => expect(screen.getByText('#1060a0')).toBeOnTheScreen());
});

it('他の色からまっちゃへ戻し、再マウントでも元のアクセントを復元する', async () => {
  let stored: PrimaryCalendarColorId = 'umi';
  const settings = {
    getPrimaryCalendarColor: jest.fn(async () => stored),
    setPrimaryCalendarColor: jest.fn(async (next: PrimaryCalendarColorId) => { stored = next; }),
  };
  function Wrapper({ children }: PropsWithChildren) {
    return <CalendarAppearanceProvider calendars={calendars} settings={settings}>{children}</CalendarAppearanceProvider>;
  }
  const hook = await renderHook(useCalendarAppearance, { wrapper: Wrapper });
  await waitFor(() => expect(hook.result.current?.colorId).toBe('umi'));
  await act(async () => { expect(await hook.result.current?.setColor('matcha')).toBe(true); });
  expect(hook.result.current?.colorId).toBe('matcha');
  expect(settings.setPrimaryCalendarColor).toHaveBeenCalledWith('matcha', expect.any(String));
  await hook.unmount();
  await render(<Wrapper><Accent /></Wrapper>);
  await waitFor(() => expect(screen.getByText('#1f7a5c')).toBeOnTheScreen());
});

it('色の保存に失敗した場合は今の表示色を保持する', async () => {
  const settings = {
    getPrimaryCalendarColor: jest.fn(async () => 'tasogare' as const),
    setPrimaryCalendarColor: jest.fn().mockRejectedValue(new Error('failed')),
  };
  const hook = await renderHook(useCalendarAppearance, {
    wrapper: ({ children }) => <CalendarAppearanceProvider calendars={calendars} settings={settings}>
      {children}
    </CalendarAppearanceProvider>,
  });
  await waitFor(() => expect(hook.result.current?.colorId).toBe('tasogare'));
  await act(async () => { expect(await hook.result.current?.setColor('wakaba')).toBe(false); });
  expect(hook.result.current?.colorId).toBe('tasogare');
  expect(hook.result.current?.error).toBe('カレンダーの色を保存できませんでした。');
});
