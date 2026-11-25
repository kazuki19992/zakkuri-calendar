import type { PrimaryCalendarColorId } from '@/domain/calendar/calendar-color';

type PresetColors = Readonly<{ accent: string; onAccent: string }>;
type CalendarColorPreset = Readonly<{
  id: PrimaryCalendarColorId;
  label: string;
  light: PresetColors;
  dark: PresetColors;
}>;

// すとろりあ src/features/customization/colorPresets.ts の配色に合わせる。
export const CALENDAR_COLOR_PRESETS: readonly CalendarColorPreset[] = [
  {
    id: 'matcha',
    label: 'まっちゃ',
    light: { accent: '#1f7a5c', onAccent: '#fffdf8' },
    dark: { accent: '#73c7a2', onAccent: '#102018' },
  },
  {
    id: 'wakaba',
    label: 'わかば',
    light: { accent: '#5a8a1a', onAccent: '#ffffff' },
    dark: { accent: '#9fd45a', onAccent: '#0f2000' },
  },
  {
    id: 'himawari',
    label: 'ひまわり',
    light: { accent: '#b08000', onAccent: '#ffffff' },
    dark: { accent: '#f0c040', onAccent: '#1a1000' },
  },
  {
    id: 'mikan',
    label: 'みかん',
    light: { accent: '#c06010', onAccent: '#ffffff' },
    dark: { accent: '#f08840', onAccent: '#1a0800' },
  },
  {
    id: 'yuuyake',
    label: 'ゆうやけ',
    light: { accent: '#c04020', onAccent: '#ffffff' },
    dark: { accent: '#f07050', onAccent: '#1a0500' },
  },
  {
    id: 'tomato',
    label: 'トマト',
    light: { accent: '#b02020', onAccent: '#ffffff' },
    dark: { accent: '#f06060', onAccent: '#1a0000' },
  },
  {
    id: 'sakura',
    label: 'さくら',
    light: { accent: '#b04070', onAccent: '#ffffff' },
    dark: { accent: '#f090b0', onAccent: '#1a0010' },
  },
  {
    id: 'tasogare',
    label: 'たそがれ',
    light: { accent: '#6030a0', onAccent: '#ffffff' },
    dark: { accent: '#a870e0', onAccent: '#0a0018' },
  },
  {
    id: 'hoshizora',
    label: 'ほしぞら',
    light: { accent: '#3040a0', onAccent: '#ffffff' },
    dark: { accent: '#7090e0', onAccent: '#00001a' },
  },
  {
    id: 'umi',
    label: 'うみ',
    light: { accent: '#1060a0', onAccent: '#ffffff' },
    dark: { accent: '#50a0e0', onAccent: '#00101a' },
  },
  {
    id: 'ramune',
    label: 'ラムネ',
    light: { accent: '#008090', onAccent: '#ffffff' },
    dark: { accent: '#40c0d0', onAccent: '#001a1a' },
  },
  {
    id: 'asatsuyu',
    label: 'あさつゆ',
    light: { accent: '#13a890', onAccent: '#ffffff' },
    dark: { accent: '#5fd8be', onAccent: '#00201a' },
  },
];

export function getCalendarColorPreset(id: PrimaryCalendarColorId): CalendarColorPreset {
  return CALENDAR_COLOR_PRESETS.find((preset) => preset.id === id)
    ?? CALENDAR_COLOR_PRESETS[0];
}
