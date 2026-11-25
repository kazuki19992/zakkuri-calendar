import {useEventLeaveGuard} from '@/features/events/hooks/use-event-leave-guard';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useRepositories } from '@/data/sqlite/app-database-provider';
import { JapaneseHolidayProvider } from '@/data/holidays/japanese-holiday-provider';
import { useCalendarRefresh } from '@/features/calendar/calendar-refresh-context';
import { useEventEditor } from '@/features/events/hooks/use-event-editor';
import { EventEditorScreen } from '@/features/events/screens/event-editor-screen';

const holidayProvider = new JapaneseHolidayProvider();

export default function EditEventRoute() {
  const router = useRouter();
  const { id, occurrenceDate } = useLocalSearchParams<{ id: string; occurrenceDate?: string }>();
  const repositories = useRepositories();
  const { notifyChanged } = useCalendarRefresh();
  const state = useEventEditor({ calendars: repositories.calendars, events: repositories.events, settings: repositories.settings, temporalDefinitions: repositories.temporalDefinitions, holidayProvider,
    eventId: id, occurrenceDate,
    initial: { date: '2000-01-01', startTime: '09:00', endTime: '10:00', temporalType: 'exact' } });
  const complete = useCallback(async (operation: () => Promise<boolean>, isSave: boolean) => {
    if (!(await operation())) return;
    notifyChanged(isSave ? state.getSavedEventLocation?.() ?? undefined : undefined);
    router.back();
  }, [notifyChanged, router, state]);
  useEventLeaveGuard(state);

  return <><Stack.Screen options={{ gestureEnabled: !state.isBusy }} /><EventEditorScreen state={state} onSave={() => void complete(state.save, true)} onDelete={() => void complete(state.remove, false)} onSelectScope={(scope) => void complete(() => state.selectScope(scope), state.scopeRequest?.operation === 'save')} onCancel={router.back} /></>;
}
