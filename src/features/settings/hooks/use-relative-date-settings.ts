import { useCallback, useEffect, useRef, useState } from 'react';
import type { SettingsRepository } from '@/domain/calendar/repositories';
import type { ThisWeekDeadlineWeekday } from '@/domain/temporal/relative-date-resolution';

export type RelativeDateSettingsState = Readonly<{
  status: 'loading' | 'ready' | 'error';
  weekday: ThisWeekDeadlineWeekday;
  error: string | null;
  isSaving: boolean;
  reload(): Promise<void>;
  setWeekday(value: ThisWeekDeadlineWeekday): Promise<boolean>;
}>;

const systemNow = () => new Date().toISOString();

export function useRelativeDateSettings({ settings, now = systemNow, loadOnMount = true }: Readonly<{
  settings: Pick<SettingsRepository, 'getThisWeekDeadlineWeekday' | 'setThisWeekDeadlineWeekday'>;
  now?: () => string;
  loadOnMount?: boolean;
}>): RelativeDateSettingsState {
  const [status, setStatus] = useState<RelativeDateSettingsState['status']>('loading');
  const [weekday, setWeekdayValue] = useState<ThisWeekDeadlineWeekday>(5);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const operationRef = useRef(false);
  const generation = useRef(0);

  const reload = useCallback(async () => {
    if (operationRef.current) return;
    const version = ++generation.current;
    setStatus('loading');
    setError(null);
    try {
      const value = await settings.getThisWeekDeadlineWeekday();
      if (generation.current !== version) return;
      setWeekdayValue(value);
      setStatus('ready');
    } catch {
      if (generation.current !== version) return;
      setStatus('error');
      setError('設定を読み込めませんでした。');
    }
  }, [settings]);

  useEffect(() => {
    let active = true;
    if (loadOnMount) void Promise.resolve().then(() => { if (active) return reload(); });
    return () => {
      active = false;
      generation.current += 1;
    };
  }, [loadOnMount, reload]);

  const setWeekday = useCallback(async (value: ThisWeekDeadlineWeekday): Promise<boolean> => {
    if (operationRef.current || status !== 'ready' || value === weekday) return false;
    operationRef.current = true;
    const version = generation.current;
    setIsSaving(true);
    setError(null);
    try {
      await settings.setThisWeekDeadlineWeekday(value, now());
      if (generation.current === version) setWeekdayValue(value);
      return true;
    } catch {
      if (generation.current === version) setError('設定を保存できませんでした。もう一度お試しください。');
      return false;
    } finally {
      operationRef.current = false;
      if (generation.current === version) setIsSaving(false);
    }
  }, [now, settings, status, weekday]);

  return { status, weekday, error, isSaving, reload, setWeekday };
}
