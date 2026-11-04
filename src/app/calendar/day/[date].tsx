import { useCallback, useId, useRef } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { isCalendarDate } from '@/domain/calendar/month';

/** preview確定と旧URLの中継。preloadでは副作用を起こさず、確定後にmainへ履歴を閉じる。 */
export default function DayRoute() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const router = useRouter();
  const request = useId();
  const redirected = useRef<string | null>(null);
  useFocusEffect(useCallback(() => {
    if (!isCalendarDate(date) || redirected.current === date) return;
    redirected.current = date;
    router.dismissTo({ pathname: '/', params: { day: date, request } });
    return () => { redirected.current = null; };
  }, [date, request, router]));
  if (isCalendarDate(date)) return <ActivityIndicator accessibilityLabel="カレンダーを開いています" />;
  return <View><Text>日付が正しくありません</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="カレンダーを開く" onPress={() => router.dismissTo('/')}><Text>カレンダーを開く</Text></Pressable>
  </View>;
}
