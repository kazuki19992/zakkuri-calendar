import type { ExactDuration } from '@/domain/calendar/event';
import { isCalendarDate, offsetCalendarDate } from '@/domain/calendar/month';
import { toMinutesOfDay, toWallClockTime } from '@/domain/calendar/time';
import type { ExactEditorRange } from './event-editor-model';

/**
 * fixedの長さを壁時計とカレンダー日付へ展開し、日跨ぎを固定ミリ秒加算に依存させない。
 * 非fixed・不正な開始入力は同一の終了値を返し、種別や入力の正当性は保存時に判断する。
 */
export function rangeForExactDuration(date: string, time: string, duration: ExactDuration): ExactEditorRange {
  const base = { startDate: date, startTime: time, endDate: date, endTime: time };
  const start = toMinutesOfDay(time);
  // 不正route入力を正当な値へ補正せず、保存時の入力検証へ渡す。
  if (duration.type !== 'fixed' || start === null || !isCalendarDate(date)) return base;
  const end = start + duration.minutes;
  return { ...base, endDate: offsetCalendarDate(date, Math.floor(end / (24 * 60))),
    endTime: toWallClockTime(end % (24 * 60)) ?? time };
}
