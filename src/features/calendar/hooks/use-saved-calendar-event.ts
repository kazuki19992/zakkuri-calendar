import { useEffect, useRef, useState } from 'react';
import type { SavedCalendarEvent } from '../calendar-refresh-context';

export function useSavedCalendarEvent({ event, ready, selectedDate, showDate, acknowledge }: Readonly<{
  event?: SavedCalendarEvent | null;
  ready: boolean;
  selectedDate: string;
  showDate(date: string): Promise<boolean>;
  acknowledge?(revision: number): void;
}>) {
  const [revealed, setRevealed] = useState<SavedCalendarEvent | null>(null);
  const consumed = useRef<number | null>(null);
  const latest = useRef(event);

  useEffect(() => { latest.current = event; }, [event]);
  useEffect(() => {
    if (!ready || !event || consumed.current === event.revision) return;
    consumed.current = event.revision;
    const move = selectedDate === event.date ? Promise.resolve(true) : showDate(event.date);
    void move.catch(() => false).then(() => {
      if (latest.current?.revision === event.revision) setRevealed(event);
    });
  }, [event, ready, selectedDate, showDate]);

  useEffect(() => {
    if (!revealed) return;
    const timer = setTimeout(() => {
      acknowledge?.(revealed.revision);
      setRevealed(null);
    }, 2600);
    return () => clearTimeout(timer);
  }, [acknowledge, revealed]);

  return revealed;
}
