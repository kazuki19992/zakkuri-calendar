import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parse,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

export type WeekStartsOn = 0 | 1;
export type MonthRange = Readonly<{ from: string; through: string }>;
export type TwoDayRange = Readonly<{ from: string; through: string }>;
export type MonthGridDate = Readonly<{
  date: string;
  dayNumber: number;
  weekday: number;
  isCurrentMonth: boolean;
}>;

const CALENDAR_DATE_FORMAT = 'yyyy-MM-dd';

function parseCalendarDate(date: string): Date {
  return parse(date, CALENDAR_DATE_FORMAT, new Date());
}

export function toCalendarDate(date: Date): string {
  return format(date, CALENDAR_DATE_FORMAT);
}

export function getMonthStart(date: string): string {
  return toCalendarDate(startOfMonth(parseCalendarDate(date)));
}

export function getMonthRange(month: string): MonthRange {
  const date = parseCalendarDate(month);
  return {
    from: toCalendarDate(startOfMonth(date)),
    through: toCalendarDate(endOfMonth(date)),
  };
}

export function moveMonth(month: string, offset: -1 | 1): string {
  return toCalendarDate(addMonths(startOfMonth(parseCalendarDate(month)), offset));
}

export function getTwoDayRange(anchorDate: string): TwoDayRange {
  return {
    from: anchorDate,
    through: toCalendarDate(addDays(parseCalendarDate(anchorDate), 1)),
  };
}

export function moveTwoDayWindow(anchorDate: string, offset: -1 | 1): string {
  return toCalendarDate(addDays(parseCalendarDate(anchorDate), offset));
}

/**
 * 任意の日数だけ月・年境界を越えて日付をずらす。2日ビューのスワイプ用
 * 予備列など、`-1 | 1`より広い範囲の日付計算が必要な箇所で使う。
 */
export function offsetCalendarDate(date: string, days: number): string {
  return toCalendarDate(addDays(parseCalendarDate(date), days));
}

export function getMonthGrid(month: string, weekStartsOn: WeekStartsOn): readonly MonthGridDate[] {
  const date = parseCalendarDate(month);
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const gridStart = startOfWeek(monthStart, { weekStartsOn });
  const naturalGridEnd = endOfWeek(monthEnd, { weekStartsOn });
  const fixedGridEnd = addDays(gridStart, 41);
  const gridEnd = naturalGridEnd > fixedGridEnd ? naturalGridEnd : fixedGridEnd;

  return eachDayOfInterval({ start: gridStart, end: gridEnd })
    .slice(0, 42)
    .map((gridDate) => ({
      date: toCalendarDate(gridDate),
      dayNumber: gridDate.getDate(),
      weekday: gridDate.getDay(),
      isCurrentMonth:
        gridDate.getFullYear() === monthStart.getFullYear() && gridDate.getMonth() === monthStart.getMonth(),
    }));
}
