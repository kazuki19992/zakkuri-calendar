/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#37352F',
    background: '#FFFFFF',
    backgroundElement: '#F7F6F3',
    backgroundSelected: '#E9E7E2',
    textSecondary: '#787774',
    calendarSaturday: '#4D708C',
    calendarHoliday: '#A55B4B',
    calendarAccent: '#8B6F5A',
    calendarBorder: '#D8D5CF',
    calendarEvent: '#DDD3C7',
    calendarEventBorder: '#A88F78',
    calendarNowIndicator: '#E03131',
  },
  dark: {
    text: '#EDECE9',
    background: '#191919',
    backgroundElement: '#252525',
    backgroundSelected: '#34312D',
    textSecondary: '#9B9A97',
    calendarSaturday: '#8EA9BF',
    calendarHoliday: '#D08A78',
    calendarAccent: '#C6A58A',
    calendarBorder: '#3F3E3B',
    calendarEvent: '#5A4B40',
    calendarEventBorder: '#B99A80',
    calendarNowIndicator: '#FF6B6B',
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
