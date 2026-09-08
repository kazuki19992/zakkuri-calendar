import { JapaneseHolidayProvider } from '@/data/holidays/japanese-holiday-provider';
import { useRepositories } from '@/data/sqlite/app-database-provider';
import { useMonthCalendar } from '@/features/calendar/hooks/use-month-calendar';
import { MonthCalendarScreen } from '@/features/calendar/screens/month-calendar-screen';

const holidayProvider = new JapaneseHolidayProvider();

export default function IndexRoute() {
  const { calendars, events, temporalDefinitions } = useRepositories();
  // TODO(v1, #9): 祝日カレンダーと、ざっくり期間・業務日計算への反映を設定可能にする。
  // TODO(v1, #10): 永続化したカレンダー設定から週の開始曜日を取得する。
  const state = useMonthCalendar({
    calendars,
    events,
    temporalDefinitions,
    holidayProvider,
    weekStartsOn: 1,
  });
  return <MonthCalendarScreen state={state} />;
}
