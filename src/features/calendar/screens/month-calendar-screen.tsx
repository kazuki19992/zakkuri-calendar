import { ScrollView, StyleSheet } from 'react-native';
import { CalendarLoadState } from '../components/calendar-load-state';
import { MonthGrid } from '../components/month-grid';
import { SelectedDayAgenda } from '../components/selected-day-agenda';
import type { MonthCalendarState } from '../hooks/use-month-calendar';

export type MonthCalendarScreenProps = Readonly<{
  state: MonthCalendarState;
  onAddEvent(date: string): void;
}>;

export function MonthCalendarScreen({ state, onAddEvent }: MonthCalendarScreenProps) {
  return (
    <CalendarLoadState status={state.status} onRetry={state.retry}>
      <ScrollView
        testID="month-calendar.scroll"
        style={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        <MonthGrid
          visibleMonth={state.visibleMonth}
          days={state.days}
          onSelectDate={state.selectDate}
          onPreviousMonth={state.showPreviousMonth}
          onToday={state.showToday}
          onNextMonth={state.showNextMonth}
        />
        <SelectedDayAgenda
          selectedDate={state.selectedDate}
          holidayName={state.selectedHolidayName}
          holidaySupport={state.holidaySupport}
          items={state.agendaItems}
          onAddEvent={() => onAddEvent(state.selectedDate)}
        />
      </ScrollView>
    </CalendarLoadState>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { flexGrow: 1 },
});
