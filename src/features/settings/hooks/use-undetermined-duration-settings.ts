import { useCallback, useEffect, useRef, useState } from 'react';
import type { SettingsRepository } from '@/domain/calendar/repositories';
import { DEFAULT_UNDETERMINED_MINUTES, parseUndeterminedMinutes } from '@/domain/temporal/temporal-preferences';

export function useUndeterminedDurationSettings({ settings, onSaved }: Readonly<{
  settings: Pick<SettingsRepository, 'getUndeterminedFadeMinutes' | 'setUndeterminedFadeMinutes'>;
  onSaved(): void;
}>) {
  const [minutes, setMinutes] = useState(DEFAULT_UNDETERMINED_MINUTES);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setSaving] = useState(false);
  const generation = useRef(0);
  const busy = useRef(false);

  const reload = useCallback(async () => {
    if (busy.current) return;
    const version = ++generation.current;
    setStatus('loading');
    setError(null);
    try {
      const value = await settings.getUndeterminedFadeMinutes();
      if (version !== generation.current) return;
      setMinutes(value);
      setStatus('ready');
    } catch {
      if (version === generation.current) {
        setStatus('error');
        setError('未定の表示時間を読み込めませんでした。');
      }
    }
  }, [settings]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) return reload(); });
    return () => {
      active = false;
      generation.current += 1;
    };
  }, [reload]);

  const saveMinutes = async (value: number) => {
    if (busy.current || status !== 'ready' || parseUndeterminedMinutes(value) === null) return false;
    busy.current = true;
    setSaving(true);
    setError(null);
    const version = generation.current;
    try {
      await settings.setUndeterminedFadeMinutes(value, new Date().toISOString());
      onSaved();
      if (version !== generation.current) return false;
      setMinutes(value);
      return true;
    } catch {
      if (version === generation.current) {
        setError('保存できませんでした。変更内容を保持しています。再試行してください。');
      }
      return false;
    } finally {
      busy.current = false;
      if (version === generation.current) setSaving(false);
    }
  };

  return { minutes, status, error, isSaving, reload, saveMinutes };
}
