import { useCallback, useId, useRef } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isCalendarDate } from '@/domain/calendar/month';

/** preview確定と旧URLの中継。preloadでは副作用を起こさず、確定後にmainへ履歴を閉じる。 */
export default function DayRoute() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const router = useRouter();
  const theme = useTheme();
  const request = useId();
  const redirected = useRef<string | null>(null);
  useFocusEffect(useCallback(() => {
    if (!isCalendarDate(date) || redirected.current === date) return;
    redirected.current = date;
    router.dismissTo({ pathname: '/', params: { day: date, request } });
    return () => { redirected.current = null; };
  }, [date, request, router]));
  return (
    <SafeAreaView testID="day-route.screen" style={[styles.screen, { backgroundColor: theme.background }]}>
      {isCalendarDate(date) ? (
        <ActivityIndicator accessibilityLabel="カレンダーを開いています" color={theme.calendarAccent} />
      ) : (
        <>
          <Text style={{ color: theme.text }}>日付が正しくありません</Text>
          <Pressable accessibilityRole="button" onPress={() => router.dismissTo('/')} style={styles.button}>
            <Text style={{ color: theme.calendarAccent }}>カレンダーを開く</Text>
          </Pressable>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  button: { minHeight: 44, justifyContent: 'center' },
});
