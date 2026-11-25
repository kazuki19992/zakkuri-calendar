import { CALENDAR_COLOR_PRESETS } from '@/constants/calendar-color-presets';
import { Colors, resolveCalendarTheme } from '@/constants/theme';
import {
  DEFAULT_EVENT_COLOR_ID,
  EVENT_COLOR_PALETTE,
  getContrastRatio,
  getEventColor,
} from '@/constants/event-colors';

jest.mock('@/global.css', () => ({}));

it('カレンダーの色はすとろりあの12色を同じ順序と名前で提供する', () => {
  expect(CALENDAR_COLOR_PRESETS.map((preset) => preset.label)).toEqual([
    'まっちゃ', 'わかば', 'ひまわり', 'みかん', 'ゆうやけ', 'トマト', 'さくら', 'たそがれ',
    'ほしぞら', 'うみ', 'ラムネ', 'あさつゆ',
  ]);
});

describe('予定の固定色パレット', () => {
  it('永続化に使える安定した8色のIDと既定色を提供する', () => {
    expect(EVENT_COLOR_PALETTE.map((color) => color.id)).toEqual([
      'blue', 'teal', 'green', 'ochre', 'orange', 'red', 'purple', 'gray',
    ]);
    expect(DEFAULT_EVENT_COLOR_ID).toBe('blue');
    expect(getEventColor('blue', 'light')).toBe(EVENT_COLOR_PALETTE[0].light);
    expect(getEventColor('blue', 'dark')).toBe(EVENT_COLOR_PALETTE[0].dark);
  });

  it.each(['light', 'dark'] as const)('%sで既定の予定色はアクセントと一致し、明示した青を保持する', (scheme) => {
    const theme = Colors[scheme];
    expect(theme.calendarAccent).toBe(scheme === 'light' ? '#1f7a5c' : '#73c7a2');
    expect(theme.calendarEvent).toBe(theme.calendarAccent);
    expect(getContrastRatio(theme.calendarEvent, theme.calendarEventText)).toBeGreaterThanOrEqual(4.5);
    expect(getEventColor('blue', scheme)).not.toBe(theme.calendarAccent);
  });

  it.each(['light', 'dark'] as const)('%sで明示したカレンダー色をアクセントと継承色に使う', (scheme) => {
    const initial = resolveCalendarTheme(scheme, null);
    expect(initial).toBe(Colors[scheme]);
    expect(resolveCalendarTheme(scheme, 'matcha')).toBe(initial);
    for (const swatch of CALENDAR_COLOR_PRESETS) {
      const theme = resolveCalendarTheme(scheme, swatch.id);
      expect(theme.calendarAccent).toBe(swatch[scheme].accent);
      expect(theme.calendarEvent).toBe(swatch[scheme].accent);
      expect(theme.calendarEventBorder).toBe(swatch[scheme].accent);
      expect(getContrastRatio(theme.calendarAccent, theme.calendarEventText)).toBeGreaterThanOrEqual(4.5);
      for (const background of [theme.background, theme.backgroundElement, theme.backgroundSelected, theme.calendarOverlay]) {
        expect(getContrastRatio(theme.calendarAccentText, background)).toBeGreaterThanOrEqual(4.5);
      }
      expect(getEventColor('red', scheme)).toBe(EVENT_COLOR_PALETTE.find((color) => color.id === 'red')?.[scheme]);
    }
  });

  it('各IDに利用者向けの固定色名を持つ', () => {
    expect(EVENT_COLOR_PALETTE.map(({ id, label }) => [id, label])).toEqual([
      ['blue', '青'],
      ['teal', '青緑'],
      ['green', '緑'],
      ['ochre', '黄土'],
      ['orange', '橙'],
      ['red', '赤'],
      ['purple', '紫'],
      ['gray', '灰'],
    ]);
  });

  it('テーマ背景色を文字色にしたとき全色が4.5対1以上のコントラストを持つ', () => {
    for (const color of EVENT_COLOR_PALETTE) {
      expect(getContrastRatio(color.light, Colors.light.background)).toBeGreaterThanOrEqual(4.5);
      expect(getContrastRatio(color.dark, Colors.dark.background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('祝日の文字色と専用背景色も両テーマで4.5対1以上を保つ', () => {
    expect(getContrastRatio(Colors.light.calendarHoliday, Colors.light.calendarHolidayBackground))
      .toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio(Colors.dark.calendarHoliday, Colors.dark.calendarHolidayBackground))
      .toBeGreaterThanOrEqual(4.5);
  });
});
