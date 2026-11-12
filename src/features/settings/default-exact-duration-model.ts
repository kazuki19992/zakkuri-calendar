import { EXACT_DURATION_PRESETS, sameExactDuration } from '@/domain/calendar/default-exact-duration';
import type { ExactDuration } from '@/domain/calendar/event';

/** 復元で値の参照が変わっても同じ候補を選べるよう、種別と分数から選択キーを作る。 */
export function exactDurationKey(value: ExactDuration): string {
  return value.type === 'fixed' ? `fixed:${value.minutes}` : value.type;
}

/** 固定候補以外の保存済み分数も、丸めず時間と分へ展開して表示する。 */
export function formatExactDuration(value: ExactDuration): string {
  if (value.type === 'instant') return '長さなし';
  if (value.type === 'undetermined') return '未定';
  const hours = Math.floor(value.minutes / 60);
  const minutes = value.minutes % 60;
  return hours === 0 ? `${minutes}分` : `${hours}時間${minutes ? `${minutes}分` : ''}`;
}

/** 候補外の現在値を一時的に追加し、別候補を選ぶまでは既存設定を失わないようにする。 */
export function defaultExactDurationOptions(value: ExactDuration) {
  const preset = EXACT_DURATION_PRESETS.some((item) => sameExactDuration(item, value));
  const values = preset ? EXACT_DURATION_PRESETS : [...EXACT_DURATION_PRESETS, value];
  return values.map((duration) => ({
    value: exactDurationKey(duration),
    label: `${formatExactDuration(duration)}${!preset && sameExactDuration(duration, value) ? '（現在の設定）' : ''}`,
    duration,
  }));
}
