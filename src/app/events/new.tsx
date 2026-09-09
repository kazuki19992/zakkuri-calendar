import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useRepositories } from '@/data/sqlite/app-database-provider';
import { useCalendarRefresh } from '@/features/calendar/calendar-refresh-context';
import { useQuickCreateEvent } from '@/features/events/hooks/use-quick-create-event';
import { QuickCreateEventScreen } from '@/features/events/screens/quick-create-event-screen';

function today(): string {
  const current = new Date();
  const year = current.getFullYear();
  const month = String(current.getMonth() + 1).padStart(2, '0');
  const day = String(current.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function NewEventRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string | string[] }>();
  const repositories = useRepositories();
  const { notifyChanged } = useCalendarRefresh();
  const initialDate = typeof params.date === 'string' ? params.date : today();
  const state = useQuickCreateEvent({
    calendars: repositories.calendars,
    events: repositories.events,
    temporalDefinitions: repositories.temporalDefinitions,
    initialDate,
  });

  const save = useCallback(async (): Promise<void> => {
    if (!(await state.save())) return;
    notifyChanged();
    router.back();
  }, [notifyChanged, router, state]);

  return <QuickCreateEventScreen state={state} onSave={save} onCancel={router.back} />;
}
