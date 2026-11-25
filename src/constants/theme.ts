import '@/global.css';

import { Platform } from 'react-native';
import { DEFAULT_CALENDAR_COLOR_ID, type PrimaryCalendarColorId } from '@/domain/calendar/calendar-color';
import { getCalendarColorPreset } from './calendar-color-presets';
import { getContrastRatio } from './event-colors';

const baseColors = {
  light: {
    text: '#202624',
    background: '#FFFFFF',
    backgroundElement: '#F3F6F4',
    textSecondary: '#53625C',
    textDisabled: '#7B8882',
    controlBorder: '#D9E2DC',
    calendarSaturday: '#1967D2',
    calendarHoliday: '#B3261E',
    danger: '#B3261E',
    calendarBorder: '#D9E2DC',
    calendarHolidayBackground: '#F3F6F4',
    calendarNowIndicator: '#EA4335',
    calendarOverlay: '#FFFFFF',
    calendarBackdrop: 'rgba(32, 33, 36, 0.32)',
  },
  dark: {
    text: '#E8EFEA',
    background: '#202124',
    backgroundElement: '#292F2C',
    textSecondary: '#ACBBB3',
    textDisabled: '#85928A',
    controlBorder: '#3B4B43',
    calendarSaturday: '#8AB4F8',
    calendarHoliday: '#F28B82',
    danger: '#F28B82',
    calendarBorder: '#3B4B43',
    calendarHolidayBackground: '#292F2C',
    calendarNowIndicator: '#F28B82',
    calendarOverlay: '#292F2C',
    calendarBackdrop: 'rgba(0, 0, 0, 0.56)',
  },
} as const;

function mixColor(background: string, foreground: string, fraction: number): string {
  const channels = [1, 3, 5].map((index) => {
    const base = Number.parseInt(background.slice(index, index + 2), 16);
    const overlay = Number.parseInt(foreground.slice(index, index + 2), 16);
    return Math.round(base + (overlay - base) * fraction).toString(16).padStart(2, '0');
  });
  return `#${channels.join('')}`;
}

function createCalendarTheme(scheme: keyof typeof baseColors, colorId: PrimaryCalendarColorId) {
  const base = baseColors[scheme];
  const { accent, onAccent } = getCalendarColorPreset(colorId)[scheme];
  const backgroundSelected = mixColor(base.background, accent, scheme === 'dark' ? 0.18 : 0.08);
  const textBackgrounds = [base.background, base.backgroundElement, base.calendarOverlay, backgroundSelected];
  let calendarAccentText = accent;
  // 面にはプリセットの値を使用し、文字だけを本文色に寄せて読みやすくする。
  for (let step = 1; step <= 10 && textBackgrounds.some((color) => getContrastRatio(calendarAccentText, color) < 4.5); step++) {
    calendarAccentText = mixColor(accent, base.text, step / 10);
  }
  const calendarEventText = getContrastRatio(accent, onAccent) >= 4.5 ? onAccent
    : getContrastRatio(accent, '#FFFFFF') > getContrastRatio(accent, '#000000') ? '#FFFFFF' : '#000000';
  return {
    ...base,
    backgroundSelected,
    calendarAccent: accent,
    calendarAccentText,
    calendarEvent: accent,
    calendarEventText,
    calendarEventBorder: accent,
  };
}

export const Colors = {
  light: createCalendarTheme('light', DEFAULT_CALENDAR_COLOR_ID),
  dark: createCalendarTheme('dark', DEFAULT_CALENDAR_COLOR_ID),
};

export function resolveCalendarTheme(scheme: keyof typeof Colors, colorId: PrimaryCalendarColorId | null) {
  return colorId === null || colorId === DEFAULT_CALENDAR_COLOR_ID ? Colors[scheme] : createCalendarTheme(scheme, colorId);
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
