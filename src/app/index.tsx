import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { JapaneseHolidayProvider } from '@/data/holidays/japanese-holiday-provider';
import { useRepositories } from '@/data/sqlite/app-database-provider';
import { useCalendarRefresh } from '@/features/calendar/calendar-refresh-context';
import { useCalendarView } from '@/features/calendar/hooks/use-calendar-view';
import { CalendarScreen } from '@/features/calendar/screens/calendar-screen';
import { CalendarDayPreview } from '@/features/calendar/components/calendar-day-preview';
import { useCalendarDayRequest } from '@/features/calendar/hooks/use-calendar-day-request';
import { isCalendarDate } from '@/domain/calendar/month';

const holidayProvider = new JapaneseHolidayProvider();

export default function IndexRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ day?: string; request?: string }>();
  const { calendars, events, settings, temporalDefinitions } = useRepositories();
  const { revision } = useCalendarRefresh();
  const state = useCalendarView({
    calendars,
    events,
    settings,
    temporalDefinitions,
    holidayProvider,
    refreshRevision: revision,
    ...(isCalendarDate(params.day) ? { initialDay: params.day } : {}),
  });
  const clearRequest = useCallback(() => router.setParams({ day: undefined, request: undefined }), [router]);
  useCalendarDayRequest({ day: params.day, request: params.request, ready: state.status === 'ready' && !state.isViewModeUpdating,
    isPeriodLoading: state.isPeriodLoading, showDay: state.showDay, clearRequest });
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
      renderDayPreview={(date) => <CalendarDayPreview date={date}
        input={{ calendars, events, settings, temporalDefinitions, holidayProvider, refreshRevision: revision }} />}
    />
  );
}
