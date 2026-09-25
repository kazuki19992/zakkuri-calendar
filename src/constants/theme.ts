/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';
import { DEFAULT_EVENT_COLOR_ID, getEventColor } from './event-colors';

export const Colors = {
  light: {
    text: '#202124',
    background: '#FFFFFF',
    backgroundElement: '#F8F9FA',
    backgroundSelected: '#E8F0FE',
    textSecondary: '#5F6368',
    calendarSaturday: '#1967D2',
    calendarHoliday: '#B3261E',
    calendarAccent: '#1A73E8',
    calendarBorder: '#DADCE0',
    calendarEvent: getEventColor(DEFAULT_EVENT_COLOR_ID, 'light'),
    calendarEventText: '#FFFFFF',
    calendarEventBorder: '#0D47A1',
    calendarHolidayBackground: '#FCE8E6',
    calendarNowIndicator: '#EA4335',
    calendarOverlay: '#FFFFFF',
    calendarBackdrop: 'rgba(32, 33, 36, 0.32)',
  },
  dark: {
    text: '#E8EAED',
    background: '#202124',
    backgroundElement: '#292A2D',
    backgroundSelected: '#3C4043',
    textSecondary: '#9AA0A6',
    calendarSaturday: '#8AB4F8',
    calendarHoliday: '#F28B82',
    calendarAccent: '#8AB4F8',
    calendarBorder: '#3C4043',
    calendarEvent: getEventColor(DEFAULT_EVENT_COLOR_ID, 'dark'),
    calendarEventText: '#202124',
    calendarEventBorder: '#8AB4F8',
    calendarHolidayBackground: '#5C1A1A',
    calendarNowIndicator: '#F28B82',
    calendarOverlay: '#292A2D',
    calendarBackdrop: 'rgba(0, 0, 0, 0.56)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
