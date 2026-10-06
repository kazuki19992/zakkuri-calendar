import { Stack, useIsPreview, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { JapaneseHolidayProvider } from '@/data/holidays/japanese-holiday-provider';
import { useRepositories } from '@/data/sqlite/app-database-provider';
import { isCalendarDate } from '@/domain/calendar/month';
import { useDayCalendar } from '@/features/calendar/hooks/use-day-calendar';
import { DayCalendarScreen } from '@/features/calendar/screens/day-calendar-screen';

const holidayProvider = new JapaneseHolidayProvider();
export default function DayRoute() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  if (!isCalendarDate(date)) return <InvalidDayRoute />;
  return <ValidDayRoute date={date} />;
}

function InvalidDayRoute() {
  const router = useRouter();
  return <View><Stack.Screen options={{ headerShown: true, title: '予定' }} />
    <Text>日付が正しくありません</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="カレンダーへ戻る" onPress={() => router.back()}><Text>カレンダーへ戻る</Text></Pressable>
  </View>;
}

function ValidDayRoute({ date }: Readonly<{ date: string }>) {
  const router = useRouter();
  const isPreview = useIsPreview();
  const repositories = useRepositories();
  const state = useDayCalendar({ date, ...repositories, holidayProvider });
  return <><Stack.Screen options={{ headerShown: !isPreview, title: `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日` }} />
    <DayCalendarScreen date={date} state={state} isPreview={isPreview} onEditEvent={(id, occurrenceDate) => router.push({ pathname: '/events/[id]', params: occurrenceDate === undefined ? { id } : { id, occurrenceDate } })} /></>;
}
