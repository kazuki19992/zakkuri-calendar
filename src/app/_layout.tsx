import { CalendarAppearanceProvider } from '@/features/calendar/calendar-appearance-provider';
import { ROUGH_TIME_SETTINGS_TITLE } from '@/features/settings/temporal-preferences-model';
import { NotificationProvider } from '@/features/notifications/notification-context';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { Platform, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppDatabaseProvider, useRepositories } from '@/data/sqlite/app-database-provider';
import { useTheme } from '@/hooks/use-theme';
import { Typography } from '@/constants/theme';
import { CalendarRefreshProvider } from '@/features/calendar/calendar-refresh-context';

export const unstable_settings = {
  anchor: 'index',
};

// iOSの標準シートに上端の余白を設け、システムの下スワイプで閉じられるようにする。
const eventSheetOptions = Platform.OS === 'ios'
  ? { presentation: 'formSheet' as const, sheetAllowedDetents: [0.96], sheetExpandsWhenScrolledToEdge: false }
  : { presentation: 'modal' as const };

function AppStack() {
  const theme = useTheme();
  const settingsHeader = {
    headerShown: true,
    headerStyle: { backgroundColor: theme.calendarOverlay },
    headerTintColor: theme.text,
    headerTitleStyle: { fontSize: Typography.title, fontWeight: '600' },
    headerBackButtonDisplayMode: 'minimal',
    gestureEnabled: true,
    animation: 'slide_from_right',
  } as const;
  return (
  <CalendarRefreshProvider>
    <NotificationProvider>
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="calendar/day/[date]" options={{ headerShown: false, gestureEnabled: false, animation: 'none' }} />
      <Stack.Screen name="events/new" options={eventSheetOptions} />
      <Stack.Screen name="events/detail/[id]" options={{ ...eventSheetOptions, headerShown: false }} />
      <Stack.Screen name="events/[id]" options={eventSheetOptions} />
      <Stack.Screen name="settings/notifications" options={{ ...settingsHeader, title: '通知' }} />
      <Stack.Screen name="settings/temporal/index" options={{ ...settingsHeader, title: ROUGH_TIME_SETTINGS_TITLE }} />
      <Stack.Screen name="settings/temporal/[id]" options={{ ...settingsHeader, title: ROUGH_TIME_SETTINGS_TITLE }} />
      <Stack.Screen name="settings" options={{ ...settingsHeader, title: '設定' }} />
    </Stack>
  </NotificationProvider>
  </CalendarRefreshProvider>
  );
}

function AppAppearance() {
  const { calendars, settings } = useRepositories();
  return (
    <CalendarAppearanceProvider calendars={calendars} settings={settings}>
      <AppStack />
    </CalendarAppearanceProvider>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <GestureHandlerRootView testID="gesture-handler-root" style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AppDatabaseProvider>
          <AppAppearance />
        </AppDatabaseProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
