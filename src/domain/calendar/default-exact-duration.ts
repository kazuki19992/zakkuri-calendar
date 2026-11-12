import type { ExactDuration } from './event';

export const DEFAULT_EXACT_DURATION = { type: 'fixed', minutes: 60 } as const;
export const EXACT_DURATION_PRESETS: readonly ExactDuration[] = [
  { type: 'instant' },
  { type: 'fixed', minutes: 10 },
  { type: 'fixed', minutes: 15 },
  { type: 'fixed', minutes: 30 },
  DEFAULT_EXACT_DURATION,
  { type: 'undetermined' },
];

/** 種別と分数の値で比較し、復元時に別オブジェクトになっても同値の設定を再保存しない。 */
export function sameExactDuration(first: ExactDuration, second: ExactDuration): boolean {
  return first.type === second.type &&
    (first.type !== 'fixed' || (second.type === 'fixed' && first.minutes === second.minutes));
}
