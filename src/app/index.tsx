import { useRouter } from 'expo-router';
import { JapaneseHolidayProvider } from '@/data/holidays/japanese-holiday-provider';
import { useRepositories } from '@/data/sqlite/app-database-provider';
import { useCalendarRefresh } from '@/features/calendar/calendar-refresh-context';
import { useCalendarView } from '@/features/calendar/hooks/use-calendar-view';
import { CalendarScreen } from '@/features/calendar/screens/calendar-screen';

const holidayProvider = new JapaneseHolidayProvider();

export default function IndexRoute() {
  const router = useRouter();
  const { calendars, events, settings, temporalDefinitions } = useRepositories();
  const { revision } = useCalendarRefresh();
  const state = useCalendarView({
    calendars,
    events,
    settings,
    temporalDefinitions,
    holidayProvider,
    refreshRevision: revision,
  });
  return (
    <CalendarScreen
      state={state}
      onAddEvent={(date) => router.push({ pathname: '/events/new', params: { date } })}
      onEditEvent={(id, occurrenceDate) => router.push({
        pathname: '/events/[id]',
        params: occurrenceDate === undefined ? { id } : { id, occurrenceDate },
      })}
      onCreateExactAt={(date, startTime) => router.push({ pathname: '/events/new', params: { date, startTime, temporalType: 'exact' } })}
      onOpenSettings={() => router.push('/settings')}
      onOpenDay={(date) => router.push({ pathname: '/calendar/day/[date]', params: { date } })}
    />
  );
}
