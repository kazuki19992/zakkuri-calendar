import { useCallback, useEffect, useRef, useState } from 'react';
import type { SettingsRepository } from '@/domain/calendar/repositories';
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
  type ReminderTiming,
} from '@/domain/notifications/reminder-timing';
export type NotificationDefaultEntry = {
  status: 'loading' | 'ready' | 'error';
  value: ReminderTiming | null;
  isSaving: boolean;
  error: string | null;
};
export type NotificationDefaultsState = {
  entries: Partial<Record<NotificationCategory, NotificationDefaultEntry>>;
  setValue(
    category: NotificationCategory,
    value: ReminderTiming | null,
  ): Promise<boolean>;
  retry(category: NotificationCategory): Promise<void>;
};
/** 各キーを独立して読み、保存失敗では以前の確定値と再試行する入力を両方保持する。 */
export function useNotificationDefaults(
  settings: Pick<
    SettingsRepository,
    'getNotificationDefault' | 'setNotificationDefault'
  >,
): NotificationDefaultsState {
  const [entries, setEntries] = useState<NotificationDefaultsState['entries']>(
    {},
  );
  const active = useRef(false),
    generations = useRef<Partial<Record<NotificationCategory, number>>>({}),
    busy = useRef(new Set<NotificationCategory>()),
    pending = useRef<
      Partial<Record<NotificationCategory, { value: ReminderTiming | null }>>
    >({});
  const patch = useCallback(
    (key: NotificationCategory, value: Partial<NotificationDefaultEntry>) => {
      if (active.current)
        setEntries((all) => ({
          ...all,
          [key]: {
            status: 'loading',
            value: null,
            isSaving: false,
            error: null,
            ...all[key],
            ...value,
          },
        }));
    },
    [],
  );
  const load = useCallback(
    async (key: NotificationCategory) => {
      if (busy.current.has(key)) return;
      const generation = (generations.current[key] ?? 0) + 1;
      generations.current[key] = generation;
      patch(key, { status: 'loading', error: null });
      try {
        const value = await settings.getNotificationDefault(key);
        if (active.current && generation === generations.current[key])
          patch(key, { status: 'ready', value, error: null });
      } catch {
        if (active.current && generation === generations.current[key])
          patch(key, {
            status: 'error',
            error: '設定を読み込めませんでした。',
          });
      }
    },
    [settings, patch],
  );
  useEffect(() => {
    const requestGenerations = generations.current;
    active.current = true;
    for (const key of NOTIFICATION_CATEGORIES) void load(key);
    return () => {
      active.current = false;
      for (const key of NOTIFICATION_CATEGORIES)
        requestGenerations[key] = (requestGenerations[key] ?? 0) + 1;
    };
  }, [load]);
  const setValue = useCallback(
    async (key: NotificationCategory, value: ReminderTiming | null) => {
      if (!active.current || busy.current.has(key)) return false;
      busy.current.add(key);
      generations.current[key] = (generations.current[key] ?? 0) + 1;
      pending.current[key] = { value };
      patch(key, { isSaving: true, error: null });
      try {
        await settings.setNotificationDefault(
          key,
          value,
          new Date().toISOString(),
        );
        if (!active.current) return false;
        delete pending.current[key];
        patch(key, { status: 'ready', value, error: null });
        return true;
      } catch {
        patch(key, { error: '設定を保存できませんでした。再試行できます。' });
        return false;
      } finally {
        busy.current.delete(key);
        patch(key, { isSaving: false });
      }
    },
    [settings, patch],
  );
  const retry = useCallback(
    async (key: NotificationCategory) => {
      const attempted = pending.current[key];
      if (attempted) await setValue(key, attempted.value);
      else await load(key);
    },
    [load, setValue],
  );
  return { entries, setValue, retry };
}
