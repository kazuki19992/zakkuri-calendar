import {useEventLeaveGuard} from '@/features/events/hooks/use-event-leave-guard';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useRepositories } from '@/data/sqlite/app-database-provider';
import { JapaneseHolidayProvider } from '@/data/holidays/japanese-holiday-provider';
import { toCalendarDate } from '@/domain/calendar/month';
import { useCalendarRefresh } from '@/features/calendar/calendar-refresh-context';
import { getDefaultEditorStartTime } from '@/features/events/event-editor-model';
import { useEventEditor } from '@/features/events/hooks/use-event-editor';
import { EventEditorScreen } from '@/features/events/screens/event-editor-screen';

const holidayProvider = new JapaneseHolidayProvider();

/**
 * 終了の明示指定をそのまま渡し、既定長の解決はeditor側へ委ねる。
 * routeで終了を補完すると利用者指定と区別できず、設定値が適用されなくなる。
 */
export default function NewEventRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string; startTime?: string; endTime?: string; temporalType?: 'exact' | 'allDay' | 'fuzzy' }>();
  const repositories = useRepositories();
  const { notifyChanged } = useCalendarRefresh();
  const now = new Date();
  const startTime = params.startTime ?? getDefaultEditorStartTime(now);
  const state = useEventEditor({
    calendars: repositories.calendars,
    events: repositories.events,
    settings: repositories.settings,
    temporalDefinitions: repositories.temporalDefinitions, holidayProvider,
    initial: {
      date: params.date ?? toCalendarDate(now),
      startTime,
      endTime: params.endTime,
      temporalType: params.temporalType ?? 'fuzzy',
    },
  });

  const save = useCallback(async (): Promise<void> => {
    if (!(await state.save())) return;
    notifyChanged(state.getSavedEventLocation?.() ?? undefined);
    router.back();
  }, [notifyChanged, router, state]);

  useEventLeaveGuard(state);


  return (
    <>
      <Stack.Screen options={{ gestureEnabled: !state.isBusy }} />
      <EventEditorScreen state={state} onSave={save} onDelete={() => {}} onCancel={router.back} />
    </>
  );
}
