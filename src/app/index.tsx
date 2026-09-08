import { JapaneseHolidayProvider } from '@/data/holidays/japanese-holiday-provider';
import { MonthCalendarScreen } from '@/features/calendar/screens/month-calendar-screen';

const holidayProvider = new JapaneseHolidayProvider();

export default function IndexRoute() {
  // TODO(v1, #9): 祝日カレンダーと、ざっくり期間・業務日計算への反映を設定可能にする。
  // TODO(v1, #10): 永続化したカレンダー設定から週の開始曜日を取得する。
  return <MonthCalendarScreen holidayProvider={holidayProvider} weekStartsOn={1} />;
}
