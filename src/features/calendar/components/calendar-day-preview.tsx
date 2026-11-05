import type { CalendarSnapshotInput } from '../calendar-snapshot';
import { useDayCalendar } from '../hooks/use-day-calendar';
import { DayCalendarScreen } from '../screens/day-calendar-screen';

export function CalendarDayPreview({ date, input }: Readonly<{
  date: string;
  input: CalendarSnapshotInput & Readonly<{ refreshRevision?: number }>;
}>) {
  const state = useDayCalendar({ ...input, date });
  return <DayCalendarScreen date={date} state={state} isPreview />;
}
