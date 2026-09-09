import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

export type CalendarRefreshState = Readonly<{
  revision: number;
  notifyChanged(): void;
}>;

const CalendarRefreshContext = createContext<CalendarRefreshState | null>(null);

export function CalendarRefreshProvider({ children }: PropsWithChildren) {
  const [revision, setRevision] = useState(0);
  const notifyChanged = useCallback(() => setRevision((current) => current + 1), []);
  const value = useMemo(() => ({ revision, notifyChanged }), [notifyChanged, revision]);

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
