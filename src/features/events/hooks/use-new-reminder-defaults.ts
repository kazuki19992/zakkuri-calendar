import { useCallback, useEffect, useRef, useState } from 'react';
import type { SettingsRepository } from '@/domain/calendar/repositories';
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
  type ReminderTiming,
} from '@/domain/notifications/reminder-timing';
import type { ReminderDraft } from '../event-editor-model';
type Entry = {
  status: 'loading' | 'ready' | 'error';
  value: ReminderTiming | null;
};
/** 新規フォームのsnapshotだけを読み、手動編集・通知なしを遅延応答で上書きしない。 */
export function useNewReminderDefaults({
  settings,
  isNew,
  category,
  ready,
  apply,
  createId,
}: {
  settings: Pick<SettingsRepository, 'getNotificationDefault'>;
  isNew: boolean;
  category: NotificationCategory;
  ready: boolean;
  apply(value: readonly ReminderDraft[]): void;
  createId(): string;
}) {
  const [values, setValues] = useState<
    Partial<Record<NotificationCategory, Entry>>
  >({});
  const [revision, setRevision] = useState(0);
  const touched = useRef(false);
  const mounted = useRef(false);
  const resetEpoch = useRef(0);
  useEffect(() => {
    mounted.current = true;
    resetEpoch.current++;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    resetEpoch.current++;
  }, [category]);
  useEffect(() => {
    if (!isNew) return;
    let active = true;
    for (const key of NOTIFICATION_CATEGORIES) {
      void settings
        .getNotificationDefault(key)
        .then((value) => {
          if (active)
            setValues((v) => ({ ...v, [key]: { status: 'ready', value } }));
        })
        .catch(() => {
          if (active)
            setValues((v) => ({
              ...v,
              [key]: { status: 'error', value: null },
            }));
        });
    }
    return () => {
      active = false;
    };
  }, [settings, isNew, revision]);
  const entry = values[category];
  const last = useRef<Entry | undefined>(undefined);
  const lastCategory = useRef<NotificationCategory | undefined>(undefined);
  useEffect(() => {
    if (!isNew || !ready || touched.current || entry?.status !== 'ready')
      return;
    if (last.current === entry && lastCategory.current === category) return;
    last.current = entry;
    lastCategory.current = category;
    apply(
      entry.value === null ? [] : [{ id: createId(), timing: entry.value }],
    );
  }, [isNew, ready, entry, category, apply, createId]);
  const markTouched = useCallback(() => {
    touched.current = true;
    resetEpoch.current++;
  }, []);
  return {
    markTouched,
    status: isNew ? (entry?.status ?? 'loading') : ('ready' as Entry['status']),
    retry: () => {
      setValues((v) =>
        Object.fromEntries(
          NOTIFICATION_CATEGORIES.map((key) => [
            key,
            { status: 'loading', value: v[key]?.value ?? null },
          ]),
        ),
      );
      setRevision((v) => v + 1);
    },
    reset: async () => {
      const epoch = ++resetEpoch.current;
      try {
        const value =
          entry?.status === 'ready'
            ? entry.value
            : await settings.getNotificationDefault(category);
        if (!mounted.current || epoch !== resetEpoch.current) return null;
        touched.current = true;
        apply(value === null ? [] : [{ id: createId(), timing: value }]);
        return true;
      } catch {
        return mounted.current && epoch === resetEpoch.current ? false : null;
      }
    },
  };
}
