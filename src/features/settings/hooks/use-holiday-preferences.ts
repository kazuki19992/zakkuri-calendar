import { useCallback, useEffect, useRef, useState } from 'react';
import type { SettingsRepository } from '@/domain/calendar/repositories';
import { DEFAULT_HOLIDAY_PREFERENCES, type HolidayPreferencesV1 } from '@/domain/calendar/holiday-preferences';

export type HolidayPreferencesState = Readonly<{
  status: 'loading' | 'ready' | 'error';
  value: HolidayPreferencesV1;
  error: string | null;
  isSaving: boolean;
  reload(): Promise<void>;
  setValue(value: HolidayPreferencesV1): Promise<boolean>;
}>;

const systemNow = () => new Date().toISOString();

export function useHolidayPreferences({ settings, onSaved, now = systemNow }: Readonly<{
  settings: Pick<SettingsRepository, 'getHolidayPreferences' | 'setHolidayPreferences'>;
  onSaved(): void;
  now?: () => string;
}>): HolidayPreferencesState {
  const [status, setStatus] = useState<HolidayPreferencesState['status']>('loading');
  const [value, setSelected] = useState<HolidayPreferencesV1>(DEFAULT_HOLIDAY_PREFERENCES);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setSaving] = useState(false);
  const mounted = useRef(false);
  const generation = useRef(0);
  const busy = useRef(false);
  const selected = useRef<HolidayPreferencesV1>(DEFAULT_HOLIDAY_PREFERENCES);

  const load = useCallback(async () => {
    if (busy.current) return;
    const request = ++generation.current;
    try {
      const loaded = await settings.getHolidayPreferences();
      if (!mounted.current || request !== generation.current) return;
      selected.current = loaded;
      setSelected(loaded);
      setStatus('ready');
      setError(null);
    } catch {
      if (!mounted.current || request !== generation.current) return;
      setStatus('error');
      setError('設定を読み込めませんでした。');
    }
  }, [settings]);

  const reload = useCallback(async () => {
    if (!mounted.current || busy.current) return;
    setStatus('loading');
    setError(null);
    await load();
  }, [load]);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    void Promise.resolve().then(() => { if (active) return load(); });
    return () => { active = false; mounted.current = false; generation.current += 1; };
  }, [load]);

  const setValue = useCallback(async (next: HolidayPreferencesV1): Promise<boolean> => {
    if (!mounted.current || busy.current || status !== 'ready' || (next.calendarId === selected.current.calendarId && next.adjustThisWeekDeadline === selected.current.adjustThisWeekDeadline)) return false;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      await settings.setHolidayPreferences(next, now());
      // 保存成功の通知は画面の生存期間に依存させない。
      onSaved();
      selected.current = next;
      if (mounted.current) setSelected(next);
      return true;
    } catch {
      if (mounted.current) setError('設定を保存できませんでした。もう一度お試しください。');
      return false;
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  }, [now, onSaved, settings, status]);

  return { status, value, error, isSaving, reload, setValue };
}
