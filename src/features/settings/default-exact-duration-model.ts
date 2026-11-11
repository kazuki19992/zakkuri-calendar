import { EXACT_DURATION_PRESETS, sameExactDuration } from '@/domain/calendar/default-exact-duration';
import type { ExactDuration } from '@/domain/calendar/event';

export function exactDurationKey(value: ExactDuration): string {
  return value.type === 'fixed' ? `fixed:${value.minutes}` : value.type;
}

export function formatExactDuration(value: ExactDuration): string {
  if (value.type === 'instant') return '長さなし';
  if (value.type === 'undetermined') return '未定';
  const hours = Math.floor(value.minutes / 60);
  const minutes = value.minutes % 60;
  return hours === 0 ? `${minutes}分` : `${hours}時間${minutes ? `${minutes}分` : ''}`;
}

export function defaultExactDurationOptions(value: ExactDuration) {
  const preset = EXACT_DURATION_PRESETS.some((item) => sameExactDuration(item, value));
  const values = preset ? EXACT_DURATION_PRESETS : [...EXACT_DURATION_PRESETS, value];
  return values.map((duration) => ({
    value: exactDurationKey(duration),
    label: `${formatExactDuration(duration)}${!preset && sameExactDuration(duration, value) ? '（現在の設定）' : ''}`,
    duration,
  }));
}
