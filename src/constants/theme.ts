import '@/global.css';

import { Platform } from 'react-native';
import { getEventColor, MAIN_CALENDAR_COLOR, type EventColorId } from './event-colors';

export const Colors = {
  light: {
    text: '#202624',
    background: '#FFFFFF',
    backgroundElement: '#F3F6F4',
    backgroundSelected: '#DDEDE7',
    textSecondary: '#53625C',
    textDisabled: '#7B8882',
    controlBorder: '#D9E2DC',
    calendarSaturday: '#1967D2',
    calendarHoliday: '#B3261E',
    danger: '#B3261E',
    calendarAccent: MAIN_CALENDAR_COLOR.light,
    calendarBorder: '#D9E2DC',
    calendarEvent: MAIN_CALENDAR_COLOR.light,
    calendarEventText: '#FFFFFF',
    calendarEventBorder: MAIN_CALENDAR_COLOR.light,
    calendarHolidayBackground: '#F3F6F4',
    calendarNowIndicator: '#EA4335',
    calendarOverlay: '#FFFFFF',
    calendarBackdrop: 'rgba(32, 33, 36, 0.32)',
  },
  dark: {
    text: '#E8EFEA',
    background: '#202124',
    backgroundElement: '#292F2C',
    backgroundSelected: '#29423A',
    textSecondary: '#ACBBB3',
    textDisabled: '#85928A',
    controlBorder: '#3B4B43',
    calendarSaturday: '#8AB4F8',
    calendarHoliday: '#F28B82',
    danger: '#F28B82',
    calendarAccent: MAIN_CALENDAR_COLOR.dark,
    calendarBorder: '#3B4B43',
    calendarEvent: MAIN_CALENDAR_COLOR.dark,
    calendarEventText: '#202124',
    calendarEventBorder: MAIN_CALENDAR_COLOR.dark,
    calendarHolidayBackground: '#292F2C',
    calendarNowIndicator: '#F28B82',
    calendarOverlay: '#292F2C',
    calendarBackdrop: 'rgba(0, 0, 0, 0.56)',
  },
} as const;

export function resolveCalendarTheme(scheme: keyof typeof Colors, colorId: EventColorId | null) {
  const base = Colors[scheme];
  if (colorId === null) return base;
  const accent = getEventColor(colorId, scheme);
  const fraction = scheme === 'dark' ? 0.18 : 0.08;
  const channels = [1, 3, 5].map((index) => {
    const background = Number.parseInt(base.background.slice(index, index + 2), 16);
    const foreground = Number.parseInt(accent.slice(index, index + 2), 16);
    return Math.round(background + (foreground - background) * fraction).toString(16).padStart(2, '0');
  });
  return {
    ...base,
    calendarAccent: accent,
    calendarEvent: accent,
    calendarEventBorder: accent,
    backgroundSelected: `#${channels.join('')}`,
  };
}

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
  twelve: 12,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radii = {
  small: 8,
  large: 12,
  full: 999,
} as const;

export const Typography = {
  caption: 12,
  body: 14,
  row: 16,
  title: 20,
  display: 28,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
