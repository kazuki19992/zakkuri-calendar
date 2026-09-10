import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { BackHandler } from 'react-native';
import { useRepositories } from '@/data/sqlite/app-database-provider';
import { toCalendarDate } from '@/domain/calendar/month';
import { toWallClockTime } from '@/domain/calendar/time';
import { useCalendarRefresh } from '@/features/calendar/calendar-refresh-context';
import { useEventEditor } from '@/features/events/hooks/use-event-editor';
import { EventEditorScreen } from '@/features/events/screens/event-editor-screen';

export default function NewEventRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string; startTime?: string; endTime?: string; temporalType?: 'exact' | 'allDay' | 'fuzzy' }>();
  const repositories = useRepositories();
  const { notifyChanged } = useCalendarRefresh();
  const startTime = params.startTime ?? new Date().toTimeString().slice(0, 5);
  const startMinutes = Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3));
  const state = useEventEditor({
    calendars: repositories.calendars,
    events: repositories.events,
    temporalDefinitions: repositories.temporalDefinitions,
    initial: {
      date: params.date ?? toCalendarDate(new Date()),
      startTime,
      endTime: params.endTime ?? toWallClockTime((startMinutes + 60) % (24 * 60)) ?? '10:00',
      temporalType: params.temporalType ?? 'exact',
    },
  });

  const save = useCallback(async (): Promise<void> => {
    if (!(await state.save())) return;
    notifyChanged();
    router.back();
  }, [notifyChanged, router, state]);

  useEffect(() => {
    if (!state.isSaving && !state.isDeleting) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => true,
    );
    return () => subscription.remove();
  }, [state.isDeleting, state.isSaving]);

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: !(state.isSaving || state.isDeleting) }} />
      <EventEditorScreen state={state} onSave={save} onDelete={() => {}} onCancel={router.back} />
    </>
  );
}
