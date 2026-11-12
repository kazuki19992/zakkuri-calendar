import { NotificationProvider } from '@/features/notifications/notification-context';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AppDatabaseProvider } from '@/data/sqlite/app-database-provider';
import { CalendarRefreshProvider } from '@/features/calendar/calendar-refresh-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <GestureHandlerRootView testID="gesture-handler-root" style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <AppDatabaseProvider>
          <CalendarRefreshProvider>
            <NotificationProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="calendar/day/[date]" options={{ headerShown: false, gestureEnabled: false, animation: 'none' }} />
              <Stack.Screen name="events/new" options={{ presentation: 'modal' }} />
              <Stack.Screen name="events/[id]" options={{ presentation: 'modal' }} />
              <Stack.Screen name="settings" options={{
                headerShown: true,
                title: '設定',
                gestureEnabled: true,
                animation: 'slide_from_right',
              }} />
            </Stack>
          </NotificationProvider>
          </CalendarRefreshProvider>
        </AppDatabaseProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
