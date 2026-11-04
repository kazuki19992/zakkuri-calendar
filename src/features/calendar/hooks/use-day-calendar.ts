import { useCallback, useEffect, useRef, useState } from 'react';
import { getMonthStart } from '@/domain/calendar/month';
import { loadCalendarSnapshot, type CalendarSnapshotInput } from '../calendar-snapshot';
import { createDayViewModel } from '../two-day-view-model';
import { createAgendaItems, type AgendaItemViewModel } from '../calendar-view-model';

export type DayCalendarState = Readonly<{
  status: 'loading' | 'ready' | 'error';
  items: readonly AgendaItemViewModel[];
  holidayName: string | null;
  holidaySupport: 'available' | 'unsupported';
  retry(): void;
}>;

export function useDayCalendar(input: CalendarSnapshotInput & Readonly<{
  date: string;
  refreshRevision?: number;
}>): DayCalendarState {
  const { date, calendars, events, settings, temporalDefinitions, holidayProvider, refreshRevision } = input;
  const [state, setState] = useState<Omit<DayCalendarState, 'retry'>>({ status: 'loading', items: [], holidayName: null, holidaySupport: 'available' });
  const retryRevision = useRef(0);
  const [retry, setRetry] = useState(0);
  const request = useRef(0);
  const reload = useCallback(() => { retryRevision.current += 1; setRetry(retryRevision.current); }, []);
  useEffect(() => {
    const requestId = ++request.current;
    void (async () => {
      try {
        const snapshot = await loadCalendarSnapshot({ calendars, events, settings, temporalDefinitions, holidayProvider }, { mode: 'day', today: date,
          anchorDate: date, selectedDate: date, visibleMonth: getMonthStart(date) });
        if (requestId !== request.current) return;
        const occurrences = snapshot.isCalendarVisible ? snapshot.occurrences : [];
        const day = createDayViewModel(date, { ...snapshot, occurrences, today: date });
        const visibleIds = new Set([...day.allDayItems, ...day.timelineItems].map((item) => item.id));
        setState({
          status: 'ready',
          items: createAgendaItems(occurrences, new Map([...snapshot.definitions.values()].map((value) => [value.id, value.label])))
            .filter((item) => visibleIds.has(item.id)),
          holidayName: day.holidayName,
          holidaySupport: day.holidaySupport,
        });
      } catch {
        if (requestId === request.current) setState({ status: 'error', items: [], holidayName: null, holidaySupport: 'available' });
      }
    })();
    return () => { request.current += 1; };
  }, [calendars, date, events, holidayProvider, refreshRevision, settings, temporalDefinitions, retry]);
  return { ...state, retry: reload };
}
