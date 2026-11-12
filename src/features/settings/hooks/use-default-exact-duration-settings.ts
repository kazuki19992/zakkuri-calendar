import { useCallback, useEffect, useRef, useState } from 'react';
import type { SettingsRepository } from '@/domain/calendar/repositories';
import type { ExactDuration } from '@/domain/calendar/event';
import { DEFAULT_EXACT_DURATION, sameExactDuration } from '@/domain/calendar/default-exact-duration';

export type DefaultExactDurationSettingsState = Readonly<{
  status: 'loading' | 'ready' | 'error';
  value: ExactDuration;
  error: string | null;
  isSaving: boolean;
  reload(): Promise<void>;
  setValue(value: ExactDuration): Promise<boolean>;
}>;

const systemNow = () => new Date().toISOString();

/**
 * 保存成功後にだけ現在値を確定し、失敗時は前の値を保持して再選択を許可する。
 * 同時保存と古い読込みを抑止し、設定変更を既存のカレンダーやdraftへ通知しない。
 */
export function useDefaultExactDurationSettings({ settings, now = systemNow }: Readonly<{
  settings: Pick<SettingsRepository, 'getDefaultExactDuration' | 'setDefaultExactDuration'>;
  now?: () => string;
}>): DefaultExactDurationSettingsState {
  const [status, setStatus] = useState<DefaultExactDurationSettingsState['status']>('loading');
  const [value, setSelected] = useState<ExactDuration>(DEFAULT_EXACT_DURATION);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setSaving] = useState(false);
  const mounted = useRef(false);
  const generation = useRef(0);
  const busy = useRef(false);
  const selected = useRef<ExactDuration>(DEFAULT_EXACT_DURATION);

  const load = useCallback(async () => {
    if (busy.current) return;
    const request = ++generation.current;
    try {
      const loaded = await settings.getDefaultExactDuration();
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

  const setValue = useCallback(async (next: ExactDuration): Promise<boolean> => {
    if (!mounted.current || busy.current || status !== 'ready' || sameExactDuration(next, selected.current)) return false;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      await settings.setDefaultExactDuration(next, now());
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
  }, [now, settings, status]);

  return { status, value, error, isSaving, reload, setValue };
}
