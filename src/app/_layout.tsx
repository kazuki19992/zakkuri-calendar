import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AppDatabaseProvider } from '@/data/sqlite/app-database-provider';
import { CalendarRefreshProvider } from '@/features/calendar/calendar-refresh-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppDatabaseProvider>
        <CalendarRefreshProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="events/new" options={{ presentation: 'modal' }} />
          </Stack>
        </CalendarRefreshProvider>
      </AppDatabaseProvider>
    </ThemeProvider>
  );
}
