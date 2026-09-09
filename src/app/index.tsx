import { useRouter } from 'expo-router';
import { JapaneseHolidayProvider } from '@/data/holidays/japanese-holiday-provider';
import { useRepositories } from '@/data/sqlite/app-database-provider';
import { useCalendarRefresh } from '@/features/calendar/calendar-refresh-context';
import { useMonthCalendar } from '@/features/calendar/hooks/use-month-calendar';
import { MonthCalendarScreen } from '@/features/calendar/screens/month-calendar-screen';

const holidayProvider = new JapaneseHolidayProvider();

export default function IndexRoute() {
  const router = useRouter();
  const { calendars, events, temporalDefinitions } = useRepositories();
  const { revision } = useCalendarRefresh();
  // TODO(v1, #9): 祝日カレンダーと、ざっくり期間・業務日計算への反映を設定可能にする。
  // TODO(v1, #10): 永続化したカレンダー設定から週の開始曜日を取得する。
  const state = useMonthCalendar({
    calendars,
    events,
    temporalDefinitions,
    holidayProvider,
    refreshRevision: revision,
    weekStartsOn: 1,
  });
  return (
    <MonthCalendarScreen
      state={state}
      onAddEvent={(date) => router.push({ pathname: '/events/new', params: { date } })}
    />
  );
}
