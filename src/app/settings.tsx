import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useRepositories } from '@/data/sqlite/app-database-provider';
import { useCalendarRefresh } from '@/features/calendar/calendar-refresh-context';
import { useCalendarBackup } from '@/features/settings/hooks/use-calendar-backup';
import { useNotifications } from '@/features/notifications/notification-context';
import { useDefaultExactDurationSettings } from '@/features/settings/hooks/use-default-exact-duration-settings';
import { useHolidayPreferences } from '@/features/settings/hooks/use-holiday-preferences';
import { useSettingsLeaveGuard } from '@/features/settings/hooks/use-settings-leave-guard';
import { useUndeterminedDurationSettings } from '@/features/settings/hooks/use-undetermined-duration-settings';
import { useWeekStartSettings } from '@/features/settings/hooks/use-week-start-settings';
import { notificationPermissionLabel } from '@/features/settings/notification-permission-label';
import { SettingsScreen } from '@/features/settings/screens/settings-screen';

export default function SettingsRoute() {
  const router = useRouter();
  const { settings } = useRepositories();
  const notificationRuntime = useNotifications();
  const backup = useCalendarBackup();
  const { notifyChanged } = useCalendarRefresh();
  const duration = useDefaultExactDurationSettings({ settings });
  const weekStart = useWeekStartSettings({ settings, onSaved: notifyChanged });
  const holidays = useHolidayPreferences({ settings, onSaved: notifyChanged });
  const undeterminedDuration = useUndeterminedDurationSettings({ settings, onSaved: notifyChanged });
  const [pendingMinutes, setPendingMinutes] = useState<number | null>(null);
  useSettingsLeaveGuard(pendingMinutes !== null && pendingMinutes !== undeterminedDuration.minutes, undeterminedDuration.isSaving);

  return (
    <SettingsScreen onOpenTemporalSettings={() => router.push('/settings/temporal')}
      onOpenNotificationSettings={() => router.push('/settings/notifications')}
      backup={backup}
      notificationStatus={notificationPermissionLabel(notificationRuntime.state.permission)}
      version={Constants.expoConfig?.version} duration={duration} weekStart={weekStart} holidays={holidays}
      undeterminedDuration={{ state: undeterminedDuration, pendingMinutes, onChangeMinutes: setPendingMinutes }} />
  );
}
