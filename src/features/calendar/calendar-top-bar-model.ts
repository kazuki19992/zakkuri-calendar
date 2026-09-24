export type CalendarTopBarModel = Readonly<{
  monthLabel: string;
  yearLabel: string | null;
  accessibilityLabel: string;
}>;

export function createCalendarTopBarModel(
  displayDate: string,
  today: string,
): CalendarTopBarModel {
  const [year, month] = displayDate.split('-').map(Number);
  const [todayYear] = today.split('-').map(Number);
  return {
    monthLabel: `${month}月`,
    yearLabel: year === todayYear ? null : String(year),
    accessibilityLabel: `${year}年${month}月、日付を選択`,
  };
}
