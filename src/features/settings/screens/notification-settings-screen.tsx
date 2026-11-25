import { NotificationSettingsSection } from '../components/notification-settings-section';
import { SettingsListScroll } from '../components/settings-list';
import type { NotificationRuntime } from '@/features/notifications/notification-context';
import type { NotificationDefaultsState } from '../hooks/use-notification-defaults';

export function NotificationSettingsScreen({ defaults, runtime }: Readonly<{
  defaults: NotificationDefaultsState;
  runtime: NotificationRuntime;
}>) {
  return (
    <SettingsListScroll>
      <NotificationSettingsSection defaults={defaults} runtime={runtime} />
    </SettingsListScroll>
  );
}
