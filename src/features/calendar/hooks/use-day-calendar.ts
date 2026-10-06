import { useCallback, useEffect, useRef, useState } from 'react';
import { expandEventOccurrences } from '@/domain/calendar/event-occurrence';
import type { HolidayProvider } from '@/domain/calendar/holiday';
import type { CalendarRepository, EventRepository, TemporalDefinitionRepository } from '@/domain/calendar/repositories';
import { createAgendaItems, type AgendaItemViewModel } from '../calendar-view-model';

export type DayCalendarState = Readonly<{
  status: 'loading' | 'ready' | 'error';
  items: readonly AgendaItemViewModel[];
  holidayName: string | null;
  retry(): void;
}>;

export function useDayCalendar(input: Readonly<{
  date: string;
  calendars: CalendarRepository;
  events: EventRepository;
  temporalDefinitions: TemporalDefinitionRepository;
  holidayProvider: HolidayProvider;
}>): DayCalendarState {
  const [state, setState] = useState<Readonly<{ status: DayCalendarState['status']; items: readonly AgendaItemViewModel[]; holidayName: string | null }>>({ status: 'loading', items: [], holidayName: null });
  const retryRevision = useRef(0);
  const [retry, setRetry] = useState(0);
  const request = useRef(0);
  const reload = useCallback(() => { retryRevision.current += 1; setRetry(retryRevision.current); }, []);
  useEffect(() => {
    const requestId = ++request.current;
    setState((current) => ({ ...current, status: 'loading' }));
    void (async () => {
      try {
        const calendar = await input.calendars.getDefault();
        const schedule = await input.events.listSchedule(calendar.id, input.date, input.date);
        const expanded = expandEventOccurrences({ snapshot: schedule, from: input.date, through: input.date });
        if (!expanded.ok) throw new Error('event occurrence expansion failed');
        const definitions = await Promise.all([...new Set(expanded.value.flatMap((occurrence) =>
          occurrence.event.temporalType === 'fuzzy' ? [occurrence.event.temporalDefinitionId] : []))]
          .map((id) => input.temporalDefinitions.getById(id)));
        if (requestId !== request.current) return;
        const holiday = input.holidayProvider.list(input.date, input.date);
        setState({
          status: 'ready',
          items: createAgendaItems(expanded.value, new Map(definitions.flatMap((value) => value === null ? [] : [[value.id, value.label] as const]))),
          holidayName: holiday.status === 'available' ? holiday.holidays[0]?.name ?? null : null,
        });
      } catch {
        if (requestId === request.current) setState({ status: 'error', items: [], holidayName: null });
      }
    })();
  }, [input.calendars, input.date, input.events, input.holidayProvider, input.temporalDefinitions, retry]);
  return { ...state, retry: reload };
}
