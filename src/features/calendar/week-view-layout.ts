import { getTimelineItemFrame, type TimelineItemViewModel } from './timeline-layout';
import { ALL_DAY_OVERFLOW_HEIGHT, createTwoDayAllDayLayout, type TwoDayViewModel } from './two-day-view-model';

export const WEEK_MIN_LANE_WIDTH = 36;
export function getWeekHeaderHeight(availableHeight: number, fontScale: number): number {
  return Math.min(Math.ceil(64 * Math.max(1, fontScale)), Math.max(44, availableHeight - ALL_DAY_OVERFLOW_HEIGHT - 44));
}

export function formatWeekRange(from: string, through: string): string {
  const includeYear = from.slice(0, 4) !== through.slice(0, 4);
  const label = (date: string) => `${includeYear ? `${Number(date.slice(0, 4))}年` : ''}${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日`;
  return `${label(from)}〜${label(through)}`;
}

export function createWeekTimelineLayout(items: readonly TimelineItemViewModel[], scale: number, columnWidth: number): Readonly<{
  items: readonly TimelineItemViewModel[];
  hiddenIds: readonly string[];
}> {
  const limit = Math.min(2, Math.max(1, Math.floor(columnWidth / WEEK_MIN_LANE_WIDTH)));
  const candidates = items.map((item) => ({ item, ...getTimelineItemFrame(item, scale) }))
    .sort((a, b) => a.top - b.top || a.item.startMinute - b.item.startMinute || a.item.id.localeCompare(b.item.id));
  const visible: TimelineItemViewModel[] = [];
  const hiddenIds: string[] = [];
  let group: TimelineItemViewModel[] = [];
  let ends: number[] = [];
  const finishGroup = () => {
    visible.push(...group.map((item) => ({ ...item, overlapCount: ends.length })));
    group = [];
    ends = [];
  };
  for (const candidate of candidates) {
    if (ends.length > 0 && candidate.top >= Math.max(...ends)) finishGroup();
    let lane = ends.findIndex((end) => end <= candidate.top);
    if (lane < 0 && ends.length < limit) lane = ends.length;
    if (lane < 0) { hiddenIds.push(candidate.item.id); continue; }
    ends[lane] = candidate.top + candidate.height;
    group.push({ ...candidate.item, overlapIndex: lane });
  }
  finishGroup();
  return { items: visible, hiddenIds };
}

export function createWeekStripLayout(strip: readonly TwoDayViewModel[], scale: number, columnWidth: number, laneLimit: number) {
  const timeline = strip.map((day) => createWeekTimelineLayout(day.timelineItems, scale, columnWidth));
  // 前後週で使ったレーンが表示週を隠さないよう、週ごとに割り当てる。
  const pages = Array.from({ length: Math.ceil(strip.length / 7) }, (_, page) => ({
    start: page * 7, layout: createTwoDayAllDayLayout(strip.slice(page * 7, page * 7 + 7), laneLimit, true),
  }));
  const allDayLayout = {
    segments: pages.flatMap(({ start, layout }) => layout.segments.map((segment) => ({ ...segment,
      id: `${segment.id}:week:${strip[start].date}`, startIndex: segment.startIndex + start }))),
    hiddenCounts: pages.flatMap(({ layout }) => layout.hiddenCounts),
  };
  return {
    allDayLayout,
    strip: strip.map((day, index) => ({ ...day, timelineItems: timeline[index].items })),
    hiddenCounts: timeline.map(({ hiddenIds }) => hiddenIds.length),
  };
}
