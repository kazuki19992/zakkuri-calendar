import { SettingsScreen } from '@/features/settings/screens/settings-screen';
import { useRelativeDateSettings } from '@/features/settings/hooks/use-relative-date-settings';
import { useRepositories } from '@/data/sqlite/app-database-provider';
import { useWeekStartSettings } from '@/features/settings/hooks/use-week-start-settings';
import { useCalendarRefresh } from '@/features/calendar/calendar-refresh-context';

export default function SettingsRoute() {
  const { settings } = useRepositories();
  const state = useRelativeDateSettings({ settings });
  const { notifyChanged } = useCalendarRefresh();
  const weekStart = useWeekStartSettings({ settings, onSaved: notifyChanged });
  return <SettingsScreen state={state} weekStart={weekStart} />;
}
