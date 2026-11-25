import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

export type SavedCalendarEvent = Readonly<{ id: string; date: string; revision: number }>;
type SavedLocation = Omit<SavedCalendarEvent, 'revision'>;

export type CalendarRefreshState = Readonly<{
  revision: number;
  notifyChanged(saved?: SavedLocation): void;
  savedEvent?: SavedCalendarEvent | null;
  acknowledgeSavedEvent?(revision: number): void;
}>;

const CalendarRefreshContext = createContext<CalendarRefreshState | null>(null);

export function CalendarRefreshProvider({ children }: PropsWithChildren) {
  const [{ revision, savedEvent }, setState] = useState<{
    revision: number;
    savedEvent: SavedCalendarEvent | null;
  }>({ revision: 0, savedEvent: null });
  const notifyChanged = useCallback((saved?: SavedLocation) => {
    setState((current) => {
      const nextRevision = current.revision + 1;
      return { revision: nextRevision, savedEvent: saved ? { ...saved, revision: nextRevision } : current.savedEvent };
    });
  }, []);
  const acknowledgeSavedEvent = useCallback((eventRevision: number) => {
    setState((current) => current.savedEvent?.revision === eventRevision ? { ...current, savedEvent: null } : current);
  }, []);
  const value = useMemo(() => ({ revision, notifyChanged, savedEvent, acknowledgeSavedEvent }),
    [acknowledgeSavedEvent, notifyChanged, revision, savedEvent]);

  return (
    <CalendarRefreshContext.Provider value={value}>{children}</CalendarRefreshContext.Provider>
  );
}

export function useCalendarRefresh(): CalendarRefreshState {
  const value = useContext(CalendarRefreshContext);
  if (!value) {
    throw new Error('useCalendarRefresh must be used within CalendarRefreshProvider');
  }
  return value;
}
