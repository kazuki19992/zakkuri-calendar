/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { resolveCalendarTheme } from '@/constants/theme';
import { useMemo } from 'react';
import { useCalendarAppearance } from './calendar-appearance-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  const theme = useColorScheme() === 'dark' ? 'dark' : 'light';

  const colorId = useCalendarAppearance()?.colorId ?? null;
  return useMemo(() => resolveCalendarTheme(theme, colorId), [theme, colorId]);
}
