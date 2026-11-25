import { createContext, useContext } from 'react';
import type { EventColorId, PrimaryCalendarColorId } from '@/domain/calendar/event-color';

export type CalendarAppearance = Readonly<{
  colorId: EventColorId | null;
  isBusy: boolean;
  error: string | null;
  setColor(colorId: PrimaryCalendarColorId): Promise<boolean>;
}>;

export const CalendarAppearanceContext = createContext<CalendarAppearance | null>(null);

export function useCalendarAppearance() {
  return useContext(CalendarAppearanceContext);
}
