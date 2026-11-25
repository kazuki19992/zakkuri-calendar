export type CalendarTopBarModel = Readonly<{
  monthLabel: string;
  yearLabel: string | null;
  accessibilityLabel: string;
}>;

export function createCalendarTopBarModel(
  displayDate: string,
  today: string,
  opensMonth = false,
): CalendarTopBarModel {
  const [year, month] = displayDate.split('-').map(Number);
  const [todayYear] = today.split('-').map(Number);
  return {
    monthLabel: `${month}月`,
    yearLabel: opensMonth && year === todayYear ? null : `${year}年`,
    accessibilityLabel: `${year}年${month}月、${opensMonth ? '月表示に切り替え' : '年月を選択'}`,
  };
}
