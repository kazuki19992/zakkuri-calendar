import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { CalendarEvent } from '@/domain/calendar/event';
import { resolveEventTime } from '@/domain/temporal/resolve-event-time';
import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';

export const MINUTES_PER_DAY = 24 * 60;
export const HOUR_HEIGHT = 56;
export const TIMELINE_HEIGHT = 24 * HOUR_HEIGHT;
export const MIN_EVENT_HEIGHT = 36;

const PIXELS_PER_MINUTE = HOUR_HEIGHT / 60;

/**
 * 画面の実測高さを24時間分の基準高さ(TIMELINE_HEIGHT)に対する倍率へ変換する。
 * 未計測(0以下)の間は初期描画のちらつきを避けるため等倍(1)を返す。
 */
export function computeTimelineScale(availableHeight: number): number {
  return availableHeight > 0 ? availableHeight / TIMELINE_HEIGHT : 1;
}

export type TimelineOpacityStop = Readonly<{ offset: number; opacity: number }>;

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
