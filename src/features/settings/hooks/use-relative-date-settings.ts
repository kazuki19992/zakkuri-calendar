import { useCallback, useEffect, useRef, useState } from 'react';
import type { SettingsRepository } from '@/domain/calendar/repositories';
import type { ThisWeekDeadlineWeekday } from '@/domain/temporal/relative-date-resolution';

export type RelativeDateSettingsState = Readonly<{
  status: 'loading' | 'ready' | 'error';
  weekday: ThisWeekDeadlineWeekday;
  error: string | null;
  isSaving: boolean;
  setWeekday(value: ThisWeekDeadlineWeekday): Promise<boolean>;
}>;

export function useRelativeDateSettings({ settings, now = () => new Date().toISOString() }: Readonly<{
  settings: SettingsRepository;
  now?: () => string;
}>): RelativeDateSettingsState {
  const [status, setStatus] = useState<RelativeDateSettingsState['status']>('loading');
  const [weekday, setWeekdayValue] = useState<ThisWeekDeadlineWeekday>(5);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const operationRef = useRef(false);

  useEffect(() => {
    let active = true;
    void settings.getThisWeekDeadlineWeekday().then((value) => {
      if (!active) return;
      setWeekdayValue(value);
      setStatus('ready');
    }).catch(() => {
      if (!active) return;
      setStatus('error');
      setError('設定を読み込めませんでした。');
    });
    return () => { active = false; };
  }, [settings]);

  const setWeekday = useCallback(async (value: ThisWeekDeadlineWeekday): Promise<boolean> => {
    if (operationRef.current || status !== 'ready' || value === weekday) return false;
    operationRef.current = true;
    setIsSaving(true);
    setError(null);
    try {
      await settings.setThisWeekDeadlineWeekday(value, now());
      setWeekdayValue(value);
      return true;
    } catch {
      setError('設定を保存できませんでした。もう一度お試しください。');
      return false;
    } finally {
      operationRef.current = false;
      setIsSaving(false);
    }
  }, [now, settings, status, weekday]);

  return { status, weekday, error, isSaving, setWeekday };
}
