import { differenceInCalendarDays, parseISO } from 'date-fns';
import { PixelRatio } from 'react-native';
import type { CalendarEvent } from '@/domain/calendar/event';
import { resolveEventTime } from '@/domain/temporal/resolve-event-time';
import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';

export const MINUTES_PER_DAY = 24 * 60;
export const HOUR_HEIGHT = 56;
export const TIMELINE_HEIGHT = 24 * HOUR_HEIGHT;
export const MIN_EVENT_HEIGHT = 36;
/** 現在時刻線の太さ。位置を下端内へ収める計算にも使う。 */
export const NOW_LINE_HEIGHT = 2;

const PIXELS_PER_MINUTE = HOUR_HEIGHT / 60;

/**
 * 画面の実測高さを24時間分の基準高さ(TIMELINE_HEIGHT)に対する倍率へ変換する。
 * 未計測(0以下)の間は初期描画のちらつきを避けるため等倍(1)を返す。
 *
 * 1時間の高さは実機ピクセルへ揃えてから倍率を求める。揃えずに
 * `availableHeight / TIMELINE_HEIGHT`をそのまま使うと、1時間ごとの罫線の
 * 位置(`hour * HOUR_HEIGHT * scale`)がピクセル境界で独立に丸められ、
 * 間隔が1pxずつ不揃いに見えることがある。
 *
 * 丸めではなく切り捨てにするのは、24時間分の全高が計測高を超えないように
 * するため。超えると`overflow: 'hidden'`により24:00付近の罫線や予定が
 * 切れてしまう。切り捨てで余るのは最大でも24物理ピクセル分(1時間あたり
 * 1物理ピクセル未満)で、見た目には影響しない。
 */
export function computeTimelineScale(availableHeight: number): number {
  if (availableHeight <= 0) return 1;
  const ratio = PixelRatio.get();
  // 極端に狭い場合でも1物理ピクセルは確保し、高さが0になって潰れるのを防ぐ。
  const hourHeight = Math.max(Math.floor((availableHeight / 24) * ratio), 1) / ratio;
  return hourHeight / HOUR_HEIGHT;
}

/**
 * 0時からの経過分数と縮尺から、現在時刻線のtop位置(px)を求める。
 */
export function computeNowLineTop(minutesSinceMidnight: number, scale: number): number {
  const top = minutesSinceMidnight * PIXELS_PER_MINUTE * scale;
  // 23:59では下端までの残りが1pt未満になり、線の太さ(NOW_LINE_HEIGHT)が
  // `overflow: 'hidden'`で切れる。線全体が内側へ収まるよう制限する。
  const maxTop = Math.max(0, TIMELINE_HEIGHT * scale - NOW_LINE_HEIGHT);
  return Math.min(top, maxTop);
}

/**
 * 指定した時刻の罫線のtop位置を、物理ピクセル境界へ吸着させて返す。
 *
 * 1時間の高さが物理ピクセルの整数倍にならない縮尺(例: 2xで21.5pt = 43px)では、
 * ptのまま`hour * 1時間の高さ`で配置すると、罫線が1本おきに半ピクセル境界へ落ちる。
 * hairlineの罫線は半ピクセル位置だとアンチエイリアスで薄くなり、背景との
 * コントラストによっては消えたように見えるため、罫線が1時間分飛んでいるように
 * 感じられる。各罫線を個別にピクセルへ吸着させることで、すべての罫線が同じ
 * 濃さで描画される。間隔は最大でも物理ピクセル1つ分しかばらつかない。
 */
export function computeHourLineTop(hour: number, scale: number): number {
  return PixelRatio.roundToNearestPixel(hour * HOUR_HEIGHT * scale);
}

export type TimelineOpacityStop = Readonly<{ offset: number; opacity: number }>;

export type TimelineTextAnchor = 'flex-start' | 'center' | 'flex-end';

/**
 * opacity stopのうち最も濃い値を持つ区間の中心offset(0〜1)を求める。
 * フェードで両端が薄くなる予定でも、最も濃い部分にテキストを配置できるようにする。
 */
export function computePeakOpacityOffset(stops: readonly TimelineOpacityStop[]): number {
  const maxOpacity = Math.max(...stops.map((stop) => stop.opacity));
  const peakOffsets = stops
    .filter((stop) => stop.opacity === maxOpacity)
    .map((stop) => stop.offset);
  return (Math.min(...peakOffsets) + Math.max(...peakOffsets)) / 2;
}

/**
 * 最も濃い位置(0〜1)を3段階のFlexbox配置へ変換し、予定テキストを常に濃い背景の上へ描画する。
 */
export function resolveTextAnchor(peakOffset: number): TimelineTextAnchor {
  if (peakOffset <= 1 / 3) return 'flex-start';
  if (peakOffset >= 2 / 3) return 'flex-end';
  return 'center';
}

export type TimelineItemViewModel = Readonly<{
  id: string;
  title: string;
  temporalLabel: string;
  accessibilityLabel: string;
  startMinute: number;
  endMinute: number;
  top: number;
  height: number;
  overlapIndex: number;
  overlapCount: number;
  opacityStops: readonly TimelineOpacityStop[];
  isInstant: boolean;
  continuesFromPreviousDay: boolean;
  continuesToNextDay: boolean;
}>;

type MutableTimelineItem = Omit<TimelineItemViewModel, 'overlapIndex' | 'overlapCount'> & {
  overlapIndex: number;
  overlapCount: number;
};

function formatTemporalLabel(event: CalendarEvent, definition: TemporalDefinition | null): string {
  if (event.temporalType === 'fuzzy') return definition?.label ?? 'ざっくり';
  if (event.temporalType === 'allDay') return '終日';
  if (event.duration.type === 'instant') return `${event.startTime}・瞬間`;
  if (event.duration.type === 'undetermined') return `${event.startTime}・未定`;
  return `${event.startTime}・${event.duration.minutes}分`;
}

function opacityAt(
  minute: number,
  startMinute: number,
  endMinute: number,
  fadeInRatio: number,
  fadeOutRatio: number,
): number {
  const duration = endMinute - startMinute;
  if (duration <= 0) return 1;
  const progress = (minute - startMinute) / duration;
  if (fadeInRatio > 0 && progress < fadeInRatio) return progress / fadeInRatio;
  const fadeOutStart = 1 - fadeOutRatio;
  if (fadeOutRatio > 0 && progress > fadeOutStart) return (1 - progress) / fadeOutRatio;
  return 1;
}

function normalizeNumber(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function createOpacityStops(input: Readonly<{
  rangeStart: number;
  rangeEnd: number;
  clipStart: number;
  clipEnd: number;
  fadeInRatio: number;
  fadeOutRatio: number;
}>): readonly TimelineOpacityStop[] {
  if (input.rangeStart === input.rangeEnd || input.clipStart === input.clipEnd) {
    return [{ offset: 0, opacity: 1 }, { offset: 1, opacity: 1 }];
  }
  const duration = input.rangeEnd - input.rangeStart;
  const candidateMinutes = [
    input.clipStart,
    input.rangeStart + duration * input.fadeInRatio,
    input.rangeEnd - duration * input.fadeOutRatio,
    input.clipEnd,
  ]
    .filter((minute) => minute >= input.clipStart && minute <= input.clipEnd)
    .sort((left, right) => left - right);
  const minutes = candidateMinutes.filter(
    (minute, index) => index === 0 || minute !== candidateMinutes[index - 1],
  );
  return minutes.map((minute) => ({
    offset: normalizeNumber((minute - input.clipStart) / (input.clipEnd - input.clipStart)),
    opacity: normalizeNumber(opacityAt(
      minute,
      input.rangeStart,
      input.rangeEnd,
      input.fadeInRatio,
      input.fadeOutRatio,
    )),
  }));
}

function assignOverlapLanes(items: MutableTimelineItem[]): void {
  let groupStart = 0;
  while (groupStart < items.length) {
    let groupEnd = groupStart + 1;
    let latestEnd = items[groupStart].startMinute + items[groupStart].height / PIXELS_PER_MINUTE;
    while (groupEnd < items.length && items[groupEnd].startMinute < latestEnd) {
      latestEnd = Math.max(
        latestEnd,
        items[groupEnd].startMinute + items[groupEnd].height / PIXELS_PER_MINUTE,
      );
      groupEnd += 1;
    }

    const laneEnds: number[] = [];
    for (let index = groupStart; index < groupEnd; index += 1) {
      const item = items[index];
      const lane = laneEnds.findIndex((endMinute) => endMinute <= item.startMinute);
      item.overlapIndex = lane === -1 ? laneEnds.length : lane;
      laneEnds[item.overlapIndex] = item.startMinute + item.height / PIXELS_PER_MINUTE;
    }
    for (let index = groupStart; index < groupEnd; index += 1) {
      items[index].overlapCount = laneEnds.length;
    }
    groupStart = groupEnd;
  }
}

export function createDayTimelineItems(input: Readonly<{
  date: string;
  events: readonly CalendarEvent[];
  definitions: ReadonlyMap<string, TemporalDefinition>;
  undeterminedFadeMinutes: number;
}>): readonly TimelineItemViewModel[] {
  const items: MutableTimelineItem[] = [];
  for (const event of input.events) {
    const definition = event.temporalType === 'fuzzy'
      ? input.definitions.get(event.temporalDefinitionId) ?? null
      : null;
    const resolved = resolveEventTime({
      event,
      definition,
      undeterminedFadeMinutes: input.undeterminedFadeMinutes,
    });
    if (resolved.kind !== 'timed') continue;

    const dayOffset = differenceInCalendarDays(parseISO(input.date), parseISO(event.anchorDate));
    const dayStart = dayOffset * MINUTES_PER_DAY;
    const dayEnd = dayStart + MINUTES_PER_DAY;
    const isInstantInDay = resolved.isInstant &&
      resolved.startMinute >= dayStart && resolved.startMinute < dayEnd;
    const clipStart = Math.max(resolved.startMinute, dayStart);
    const clipEnd = Math.min(resolved.endMinute, dayEnd);
    if (!isInstantInDay && clipEnd <= clipStart) continue;

    const startMinute = clipStart - dayStart;
    const endMinute = clipEnd - dayStart;
    const semanticHeight = (endMinute - startMinute) * PIXELS_PER_MINUTE;
    const height = Math.max(semanticHeight, MIN_EVENT_HEIGHT);
    const temporalLabel = formatTemporalLabel(event, definition);
    const continuesFromPreviousDay = clipStart > resolved.startMinute;
    const continuesToNextDay = clipEnd < resolved.endMinute;
    const continuationLabels = [
      continuesFromPreviousDay ? '前日から継続' : null,
      continuesToNextDay ? '翌日へ継続' : null,
    ].filter((label): label is string => label !== null);

    items.push({
      id: event.id,
      title: event.title,
      temporalLabel,
      accessibilityLabel: [event.title, temporalLabel, ...continuationLabels].join('、'),
      startMinute,
      endMinute,
      top: startMinute * PIXELS_PER_MINUTE,
      height,
      overlapIndex: 0,
      overlapCount: 1,
      opacityStops: createOpacityStops({
        rangeStart: resolved.startMinute,
        rangeEnd: resolved.endMinute,
        clipStart,
        clipEnd,
        fadeInRatio: resolved.fadeInRatio,
        fadeOutRatio: resolved.fadeOutRatio,
      }),
      isInstant: resolved.isInstant,
      continuesFromPreviousDay,
      continuesToNextDay,
    });
  }

  items.sort((left, right) =>
    left.startMinute - right.startMinute ||
    left.endMinute - right.endMinute ||
    left.id.localeCompare(right.id),
  );
  assignOverlapLanes(items);
  return items;
}
