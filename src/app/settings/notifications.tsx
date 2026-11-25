import { useRepositories } from '@/data/sqlite/app-database-provider';
import { useNotifications } from '@/features/notifications/notification-context';
import { useNotificationDefaults } from '@/features/settings/hooks/use-notification-defaults';
import { NotificationSettingsScreen } from '@/features/settings/screens/notification-settings-screen';

export default function NotificationSettingsRoute() {
  const { settings } = useRepositories();
  const defaults = useNotificationDefaults(settings);
  const runtime = useNotifications();

  return <NotificationSettingsScreen defaults={defaults} runtime={runtime} />;
}
