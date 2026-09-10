import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { BackHandler } from 'react-native';
import { useRepositories } from '@/data/sqlite/app-database-provider';
import { useCalendarRefresh } from '@/features/calendar/calendar-refresh-context';
import { useEventEditor } from '@/features/events/hooks/use-event-editor';
import { EventEditorScreen } from '@/features/events/screens/event-editor-screen';

export default function EditEventRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const repositories = useRepositories();
  const { notifyChanged } = useCalendarRefresh();
  const state = useEventEditor({ calendars: repositories.calendars, events: repositories.events, temporalDefinitions: repositories.temporalDefinitions,
    eventId: id, initial: { date: '2000-01-01', startTime: '09:00', endTime: '10:00', temporalType: 'exact' } });
  const complete = useCallback(async (operation: () => Promise<boolean>) => { if (await operation()) { notifyChanged(); router.back(); } }, [notifyChanged, router]);
  useEffect(() => {
    if (!state.isSaving && !state.isDeleting) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [state.isDeleting, state.isSaving]);
  return <><Stack.Screen options={{ gestureEnabled: !(state.isSaving || state.isDeleting) }} /><EventEditorScreen state={state} onSave={() => void complete(state.save)} onDelete={() => void complete(state.remove)} onCancel={router.back} /></>;
}
