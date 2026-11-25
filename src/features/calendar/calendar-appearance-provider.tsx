import { useCallback, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { DEFAULT_CALENDAR_TEAL, DEFAULT_EVENT_COLOR_ID, type EventColorId, type PrimaryCalendarColorId } from '@/domain/calendar/event-color';
import type { CalendarRepository, SettingsRepository } from '@/domain/calendar/repositories';
import { CalendarAppearanceContext } from '@/hooks/calendar-appearance-context';

export function CalendarAppearanceProvider({ calendars, settings, children }: PropsWithChildren<{
  calendars: Pick<CalendarRepository, 'getDefault'>;
  settings: Pick<SettingsRepository, 'getPrimaryCalendarColor' | 'setPrimaryCalendarColor'>;
}>) {
  const [colorId, setColorId] = useState<EventColorId | null>(null);
  const [isBusy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const busy = useRef(true);

  useEffect(() => {
    const operation = ++generation.current;
    busy.current = true;
    void (async () => {
      try {
        const saved = await settings.getPrimaryCalendarColor();
        const calendarColor = saved === null ? (await calendars.getDefault()).colorId : null;
        if (operation !== generation.current) return;
        // 以前の青は初期シード。明示設定の青は別キーに保存して区別する。
        setColorId(saved === DEFAULT_CALENDAR_TEAL ? null : saved ?? (calendarColor === DEFAULT_EVENT_COLOR_ID ? null : calendarColor));
        setError(null);
      } catch {
        if (operation === generation.current) setError('カレンダーの色を読み込めませんでした。');
      } finally {
        if (operation === generation.current) {
          busy.current = false;
          setBusy(false);
        }
      }
    })();
    return () => { generation.current += 1; };
  }, [calendars, settings]);

  const setColor = useCallback(async (next: PrimaryCalendarColorId) => {
    if (busy.current) return false;
    const operation = generation.current;
    busy.current = true;
    setBusy(true);
    setError(null);
    try {
      await settings.setPrimaryCalendarColor(next, new Date().toISOString());
      if (operation !== generation.current) return false;
      setColorId(next === DEFAULT_CALENDAR_TEAL ? null : next);
      return true;
    } catch {
      if (operation === generation.current) setError('カレンダーの色を保存できませんでした。');
      return false;
    } finally {
      if (operation === generation.current) {
        busy.current = false;
        setBusy(false);
      }
    }
  }, [settings]);

  return (
    <CalendarAppearanceContext.Provider value={{ colorId, isBusy, error, setColor }}>
      {children}
    </CalendarAppearanceContext.Provider>
  );
}
