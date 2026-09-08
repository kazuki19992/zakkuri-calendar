import type { HolidayProvider } from '@/domain/calendar/holiday';
import type { WeekStartsOn } from '@/domain/calendar/month';
import { useRepositories } from '@/data/sqlite/app-database-provider';
import { CalendarLoadState } from '../components/calendar-load-state';
import { MonthGrid } from '../components/month-grid';
import { SelectedDayAgenda } from '../components/selected-day-agenda';
import { useMonthCalendar } from '../hooks/use-month-calendar';

export type MonthCalendarScreenProps = Readonly<{
  holidayProvider: HolidayProvider;
  weekStartsOn: WeekStartsOn;
}>;

export function MonthCalendarScreen({ holidayProvider, weekStartsOn }: MonthCalendarScreenProps) {
  const { calendars, events, temporalDefinitions } = useRepositories();
  const state = useMonthCalendar({
    calendars,
    events,
    temporalDefinitions,
    holidayProvider,
    weekStartsOn,
  });

  return (
    <CalendarLoadState status={state.status} onRetry={state.retry}>
      <MonthGrid
        visibleMonth={state.visibleMonth}
        days={state.days}
        onSelectDate={state.selectDate}
        onVisibleMonthChange={state.selectDate}
        onPreviousMonth={state.showPreviousMonth}
        onToday={state.showToday}
        onNextMonth={state.showNextMonth}
      />
      <SelectedDayAgenda
        selectedDate={state.selectedDate}
        holidayName={state.selectedHolidayName}
        holidaySupport={state.holidaySupport}
        items={state.agendaItems}
      />
    </CalendarLoadState>
  );
}
