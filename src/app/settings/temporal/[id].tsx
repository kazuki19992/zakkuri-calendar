import { ROUGH_TIME_SETTINGS_TITLE } from '@/features/settings/temporal-preferences-model';
import { AndroidHaptics, performAndroidHapticsAsync, selectionAsync } from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useRepositories } from '@/data/sqlite/app-database-provider';
import { useCalendarRefresh } from '@/features/calendar/calendar-refresh-context';
import { useHolidayPreferences } from '@/features/settings/hooks/use-holiday-preferences';
import { useRelativeDateSettings } from '@/features/settings/hooks/use-relative-date-settings';
import { useSettingsLeaveGuard } from '@/features/settings/hooks/use-settings-leave-guard';
import { useTemporalDefinitionSettings } from '@/features/settings/hooks/use-temporal-definition-settings';
import { TemporalDefinitionSaveAction, TemporalDefinitionSettingsScreen } from '@/features/settings/screens/temporal-definition-settings-screen';

function playSelectionFeedback() {
  if (Platform.OS === 'android') {
    void performAndroidHapticsAsync(AndroidHaptics.Segment_Frequent_Tick).catch(() => {});
  } else if (Platform.OS === 'ios') {
    void selectionAsync().catch(() => {});
  }
}

export default function TemporalDefinitionSettingsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { settings, temporalDefinitions } = useRepositories();
  const { notifyChanged } = useCalendarRefresh();
  const state = useTemporalDefinitionSettings({
    id: typeof id === 'string' ? id : '', repository: temporalDefinitions, onSaved: notifyChanged,
  });
  const deadline = useRelativeDateSettings({ settings });
  const holidays = useHolidayPreferences({ settings, onSaved: notifyChanged });
  const [leaving, setLeaving] = useState(false);
  useSettingsLeaveGuard(!leaving && state.dirty, !leaving && (state.isSaving || deadline.isSaving || holidays.isSaving));
  useEffect(() => { if (leaving) router.back(); }, [leaving, router]);

  return <>
    <Stack.Screen options={{
      title: state.draft?.label ?? ROUGH_TIME_SETTINGS_TITLE,
      headerRight: () => <TemporalDefinitionSaveAction state={state} />,
    }} />
    <TemporalDefinitionSettingsScreen state={state} thisWeek={{ deadline, holidays }}
      onSnap={playSelectionFeedback} onSaved={() => setLeaving(true)} />
  </>;
}
