import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useRepositories } from '@/data/sqlite/app-database-provider';
import { useRelativeDateSettings } from '@/features/settings/hooks/use-relative-date-settings';
import { useTemporalPreferences } from '@/features/settings/hooks/use-temporal-preferences';
import { TemporalPreferencesScreen } from '@/features/settings/screens/temporal-preferences-screen';

export default function TemporalPreferencesRoute() {
  const { calendars, settings, temporalDefinitions } = useRepositories();
  const router = useRouter();
  const state = useTemporalPreferences({ calendars, definitions: temporalDefinitions });
  const deadline = useRelativeDateSettings({ settings, loadOnMount: false });
  const { reload } = state;
  const { reload: reloadDeadline } = deadline;
  useFocusEffect(useCallback(() => {
    void reload();
    void reloadDeadline();
  }, [reload, reloadDeadline]));

  return (
    <TemporalPreferencesScreen state={state} deadlineWeekday={deadline.status === 'ready' ? deadline.weekday : undefined}
      onOpen={(id) => router.push({ pathname: '/settings/temporal/[id]', params: { id } })} />
  );
}
