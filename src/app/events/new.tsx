import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { BackHandler } from 'react-native';
import { useRepositories } from '@/data/sqlite/app-database-provider';
import { JapaneseHolidayProvider } from '@/data/holidays/japanese-holiday-provider';
import { toCalendarDate } from '@/domain/calendar/month';
import { useCalendarRefresh } from '@/features/calendar/calendar-refresh-context';
import { useEventEditor } from '@/features/events/hooks/use-event-editor';
import { EventEditorScreen } from '@/features/events/screens/event-editor-screen';

const holidayProvider = new JapaneseHolidayProvider();

export default function NewEventRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string; startTime?: string; endTime?: string; temporalType?: 'exact' | 'allDay' | 'fuzzy' }>();
  const repositories = useRepositories();
  const { notifyChanged } = useCalendarRefresh();
  const startTime = params.startTime ?? new Date().toTimeString().slice(0, 5);
  const state = useEventEditor({
    calendars: repositories.calendars,
    events: repositories.events,
    settings: repositories.settings,
    temporalDefinitions: repositories.temporalDefinitions, holidayProvider,
    initial: {
      date: params.date ?? toCalendarDate(new Date()),
      startTime,
      endTime: params.endTime,
      temporalType: params.temporalType ?? 'fuzzy',
    },
    initialTab: params.temporalType === 'exact' || params.temporalType === 'allDay'
      ? 'exact'
      : undefined,
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
