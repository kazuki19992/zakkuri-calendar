import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { Alert, AppState, Pressable, Text, View } from 'react-native';
import { useRootNavigationState, useRouter } from 'expo-router';
import { useRepositories } from '@/data/sqlite/app-database-provider';
import {
  createNotificationDevice,
  observeNotificationEvents,
} from '@/data/notifications/notification-device';
import { useCalendarRefresh } from '@/features/calendar/calendar-refresh-context';
import { useTheme } from '@/hooks/use-theme';
import {
  NotificationCoordinator,
  type NotificationState,
} from './notification-coordinator';
import { NotificationResponseQueue } from './notification-response-queue';
export type NotificationRuntime = {
  state: NotificationState;
  retry(): Promise<void>;
  requestPermission(): Promise<void>;
  openSettings(): Promise<void>;
  openAlarmSettings(): Promise<void>;
};
const Context = createContext<NotificationRuntime | null>(null);
export function useNotifications() {
  const value = useContext(Context);
  if (!value) throw Error('NotificationProvider is required');
  return value;
}
/** 保存完了後のrevisionとOSライフサイクルを、DB準備後の単一coordinatorへ集約する。 */
export function NotificationProvider({ children }: PropsWithChildren) {
  const repositories = useRepositories(),
    { revision } = useCalendarRefresh(),
    router = useRouter(),
    navigation = useRootNavigationState(),
    theme = useTheme();
  const insets = useContext(SafeAreaInsetsContext);
  const coordinator = useMemo(
    () =>
      new NotificationCoordinator(
        repositories.notifications,
        createNotificationDevice(),
      ),
    [repositories.notifications],
  );
  const state = useSyncExternalStore(
    coordinator.subscribe,
    coordinator.getState,
    coordinator.getState,
  );
  const [active, setActive] = useState(AppState.currentState === 'active'),
    [dismissed, setDismissed] = useState(false);
  const queue = useMemo(
    () =>
      new NotificationResponseQueue(
        repositories.events,
        (target) => {
          if (target)
            router.push({
              pathname: '/events/[id]',
              params: {
                id: target.eventId,
                ...(target.occurrenceDate
                  ? { occurrenceDate: target.occurrenceDate }
                  : {}),
              },
            });
          else {
            router.replace('/');
            Alert.alert(
              '予定を開けません',
              'この予定は変更または削除されています。',
            );
          }
        },
        () =>
          Alert.alert(
            '予定を開けません',
            '予定を読み込めませんでした。アプリを開き直して再試行してください。',
          ),
      ),
    [repositories.events, router],
  );
  useEffect(() => {
    queue.setReady(Boolean(navigation?.key) && active);
    return () => queue.setReady(false);
  }, [queue, navigation?.key, active]);
  useEffect(
    () =>
      observeNotificationEvents(
        () => {
          void coordinator.reconcile();
        },
        (response) => queue.receive(response),
      ),
    [coordinator, queue],
  );
  useEffect(() => {
    void coordinator.reconcile();
  }, [coordinator, revision]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      setActive(next === 'active');
      if (next === 'active') {
        void coordinator.reconcile();
        void queue.flush();
      }
    });
    // active中の時刻・ゾーン変更と予約済み通知の消費を1分間隔で照合する。
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void coordinator.reconcile();
    }, 60000);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, [coordinator, queue]);
  const runtime = useMemo<NotificationRuntime>(
    () => ({
      state,
      retry: coordinator.reconcile,
      requestPermission: () => coordinator.requestPermission(),
      openSettings: () => coordinator.device.openSettings(),
      openAlarmSettings: () => coordinator.device.openAlarmSettings(),
    }),
    [coordinator, state],
  );
  const permissionNotice =
    state.hasReminders &&
    (state.permission === 'denied' || state.permission === 'undetermined');
  const notice = !dismissed && (permissionNotice || state.status === 'error');
  return (
    <Context.Provider value={runtime}>
      <View style={{ flex: 1 }}>
        {children}
        {notice ? (
          <View
            accessibilityRole="summary"
            style={{
              padding: 16,
              paddingBottom: Math.max(16, insets?.bottom ?? 0),
              gap: 8,
              backgroundColor: theme.backgroundElement,
            }}
          >
            <Text style={{ color: theme.text }}>
              {state.status === 'error'
                ? '予定は保存されています。一部の通知を準備できませんでした。'
                : '予定は保存されています。通知を受け取るには許可が必要です。'}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
              <Pressable
                accessibilityRole="button"
                style={{ minHeight: 44, justifyContent: 'center' }}
                onPress={() => {
                  void (
                    state.status === 'error'
                      ? runtime.retry()
                      : state.permission === 'undetermined'
                        ? runtime.requestPermission()
                        : runtime.openSettings()
                  ).catch(() =>
                    Alert.alert(
                      '設定を開けません',
                      '端末の設定から通知の許可をご確認ください。',
                    ),
                  );
                }}
              >
                <Text style={{ color: theme.calendarAccent }}>
                  {state.status === 'error'
                    ? '通知を再試行'
                    : state.permission === 'undetermined'
                      ? '通知を許可する'
                      : '端末の設定を開く'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={{ minHeight: 44, justifyContent: 'center' }}
                onPress={() => setDismissed(true)}
              >
                <Text style={{ color: theme.textSecondary }}>後で</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </Context.Provider>
  );
}
