import { SettingsScreen } from '@/features/settings/screens/settings-screen';
import { useRelativeDateSettings } from '@/features/settings/hooks/use-relative-date-settings';
import { useRepositories } from '@/data/sqlite/app-database-provider';

export default function SettingsRoute() {
  const { settings } = useRepositories();
  const state = useRelativeDateSettings({ settings });
  return <SettingsScreen state={state} />;
}
