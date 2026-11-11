import { useDefaultExactDurationSettings } from '@/features/settings/hooks/use-default-exact-duration-settings';
import { SettingsScreen } from '@/features/settings/screens/settings-screen';
import { useRelativeDateSettings } from '@/features/settings/hooks/use-relative-date-settings';
import { useRepositories } from '@/data/sqlite/app-database-provider';
import { useWeekStartSettings } from '@/features/settings/hooks/use-week-start-settings';
import { useCalendarRefresh } from '@/features/calendar/calendar-refresh-context';
import { useHolidayPreferences } from '@/features/settings/hooks/use-holiday-preferences';

export default function SettingsRoute() {
  const { settings } = useRepositories();
  const duration = useDefaultExactDurationSettings({ settings });
  const state = useRelativeDateSettings({ settings });
  const { notifyChanged } = useCalendarRefresh();
  const weekStart = useWeekStartSettings({ settings, onSaved: notifyChanged });
  const holidays = useHolidayPreferences({ settings, onSaved: notifyChanged });
  return <SettingsScreen duration={duration} state={state} weekStart={weekStart} holidays={holidays} />;
}
