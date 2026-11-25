import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { JapaneseHolidayProvider } from '@/data/holidays/japanese-holiday-provider';
import { useRepositories } from '@/data/sqlite/app-database-provider';
import { useCalendarRefresh } from '@/features/calendar/calendar-refresh-context';
import { RecurrenceScopeDialog } from '@/features/events/components/recurrence-scope-dialog';
import { useEventDetails } from '@/features/events/hooks/use-event-details';
import { useEventEditor } from '@/features/events/hooks/use-event-editor';
import { EventDetailScreen } from '@/features/events/screens/event-detail-screen';

const holidayProvider = new JapaneseHolidayProvider();

export default function EventDetailRoute() {
  const { id, occurrenceDate } = useLocalSearchParams<{ id: string; occurrenceDate?: string }>();
  const router = useRouter();
  const { calendars, events, settings, temporalDefinitions } = useRepositories();
  const { revision, notifyChanged } = useCalendarRefresh();
  const state = useEventDetails({ events, temporalDefinitions, id, occurrenceDate, revision });
  const deletion = useEventEditor({
    calendars, events, settings, temporalDefinitions, holidayProvider,
    eventId: id, occurrenceDate,
    initial: { date: '2000-01-01', startTime: '09:00', endTime: '10:00', temporalType: 'exact' },
  });

  const completeRemoval = async (operation: () => Promise<boolean>) => {
    if (!(await operation())) return;
    notifyChanged();
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: !deletion.isBusy }} />
      <EventDetailScreen state={state} deleting={deletion.isBusy} canDelete={deletion.status === 'ready'}
        usesScopeSelection={deletion.usesRecurrenceScope} deleteError={deletion.saveError}
        onClose={router.back} onDelete={() => { void completeRemoval(deletion.remove); }}
        onEdit={() => router.replace({
          pathname: '/events/[id]',
          params: { id, occurrenceDate },
        })} />
      <RecurrenceScopeDialog request={deletion.scopeRequest} busy={deletion.isBusy}
        showUnsavedWarning={false} onCancel={deletion.cancelScope}
        onSelect={(scope) => { void completeRemoval(() => deletion.selectScope(scope)); }} />
    </>
  );
}
