import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExactDuration } from '@/domain/calendar/event';
import type { SettingsRepository } from '@/domain/calendar/repositories';

/** 新規フォームの初期化は一度だけ。設定の再取得で編集中のdraftを追従させない。 */
export function useNewEventDuration({ settings, enabled, onResolved }: Readonly<{
  settings: Pick<SettingsRepository, 'getDefaultExactDuration'>;
  enabled: boolean;
  onResolved(value: ExactDuration): void;
}>) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(enabled ? 'loading' : 'ready');
  const initialized = useRef(false);
  const mounted = useRef(false);
  const generation = useRef(0);
  const busy = useRef(false);
  const callback = useRef(onResolved);
  useEffect(() => { callback.current = onResolved; }, [onResolved]);
  const load = useCallback(async () => {
    if (!enabled || !mounted.current || initialized.current || busy.current) return;
    const request = ++generation.current;
    busy.current = true;
    setStatus('loading');
    try {
      const value = await settings.getDefaultExactDuration();
      if (!mounted.current || generation.current !== request) return;
      callback.current(value);
      initialized.current = true;
      setStatus('ready');
    } catch {
      if (mounted.current && generation.current === request) setStatus('error');
    } finally {
      if (generation.current === request) busy.current = false;
    }
  }, [enabled, settings]);
  useEffect(() => {
    mounted.current = true;
    busy.current = false;
    let active = true;
    void Promise.resolve().then(() => { if (active) return load(); });
    return () => { active = false; mounted.current = false; generation.current += 1; };
  }, [load]);
  return { status, retry: load };
}
