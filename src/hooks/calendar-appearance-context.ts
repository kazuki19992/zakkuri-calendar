import { createContext, useContext } from 'react';
import type { PrimaryCalendarColorId } from '@/domain/calendar/calendar-color';

export type CalendarAppearance = Readonly<{
  colorId: PrimaryCalendarColorId;
  isBusy: boolean;
  error: string | null;
  setColor(colorId: PrimaryCalendarColorId): Promise<boolean>;
}>;

export const CalendarAppearanceContext = createContext<CalendarAppearance | null>(null);

export function useCalendarAppearance() {
  return useContext(CalendarAppearanceContext);
}
