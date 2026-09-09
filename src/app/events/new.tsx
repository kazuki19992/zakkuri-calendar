import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { BackHandler } from 'react-native';
import { useRepositories } from '@/data/sqlite/app-database-provider';
import { toCalendarDate } from '@/domain/calendar/month';
import { useCalendarRefresh } from '@/features/calendar/calendar-refresh-context';
import { useQuickCreateEvent } from '@/features/events/hooks/use-quick-create-event';
import { QuickCreateEventScreen } from '@/features/events/screens/quick-create-event-screen';

export default function NewEventRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string | string[] }>();
  const repositories = useRepositories();
  const { notifyChanged } = useCalendarRefresh();
  const initialDate = typeof params.date === 'string' ? params.date : toCalendarDate(new Date());
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

  useEffect(() => {
    if (!state.isSaving) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => true,
    );
    return () => subscription.remove();
  }, [state.isSaving]);

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: state.isSaving !== true }} />
      <QuickCreateEventScreen state={state} onSave={save} onCancel={router.back} />
    </>
  );
}
