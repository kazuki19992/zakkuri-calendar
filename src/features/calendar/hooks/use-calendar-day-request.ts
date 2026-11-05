import { useEffect, useRef, useState } from 'react';
import { isCalendarDate } from '@/domain/calendar/month';

/** preview確定と旧URLの要求を直列に消費し、完了済み要求による日付の巻き戻しを防ぐ。 */
export function useCalendarDayRequest(input: Readonly<{
  day?: string;
  request?: string;
  ready: boolean;
  isPeriodLoading: boolean;
  showDay(date: string): Promise<boolean>;
  clearRequest(): void;
}>) {
  const { day, request, ready, isPeriodLoading, showDay, clearRequest } = input;
  const active = useRef(false);
  const consumed = useRef<string | null>(null);
  const latest = useRef<string | null>(null);
  const mounted = useRef(true);
  const [revision, setRevision] = useState(0);
  const key = isCalendarDate(day) ? `${request ?? ''}:${day}` : null;
  useEffect(() => { latest.current = key; }, [key]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (key === null) { consumed.current = null; return; }
    if (!ready || isPeriodLoading || active.current || consumed.current === key || !isCalendarDate(day)) return;
    active.current = true;
    consumed.current = key;
    void showDay(day).catch(() => false).finally(() => {
      active.current = false;
      if (!mounted.current) return;
      if (latest.current === key) clearRequest();
      setRevision((value) => value + 1);
    });
  }, [day, ready, isPeriodLoading, showDay, clearRequest, key, revision]);
}
