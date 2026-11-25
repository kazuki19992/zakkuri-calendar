import type { EventColorId } from './event-color';

const CALENDAR_COLOR_IDS = [
  'matcha', 'wakaba', 'himawari', 'mikan', 'yuuyake', 'tomato',
  'sakura', 'tasogare', 'hoshizora', 'umi', 'ramune', 'asatsuyu',
] as const;

export type PrimaryCalendarColorId = (typeof CALENDAR_COLOR_IDS)[number];

export const DEFAULT_CALENDAR_COLOR_ID = 'matcha' satisfies PrimaryCalendarColorId;

const PREVIEW_COLOR_IDS: Readonly<Record<EventColorId | 'default-teal', PrimaryCalendarColorId>> = {
  'default-teal': 'matcha',
  blue: 'umi',
  teal: 'ramune',
  green: 'wakaba',
  ochre: 'himawari',
  orange: 'mikan',
  red: 'tomato',
  purple: 'tasogare',
  gray: 'matcha',
};

export function isPrimaryCalendarColorId(value: unknown): value is PrimaryCalendarColorId {
  return CALENDAR_COLOR_IDS.some((id) => id === value);
}

export function parsePrimaryCalendarColorId(value: unknown): PrimaryCalendarColorId | null {
  if (isPrimaryCalendarColorId(value)) return value;
  // 旧プレビューの設定だけ読み替える。予定の色IDには適用しない。
  if (typeof value === 'string' && Object.hasOwn(PREVIEW_COLOR_IDS, value)) {
    return PREVIEW_COLOR_IDS[value as keyof typeof PREVIEW_COLOR_IDS];
  }
  return null;
}
