import { getTimelineItemFrame, type TimelineItemViewModel } from './timeline-layout';
import { createTwoDayAllDayLayout, type TwoDayViewModel } from './two-day-view-model';

export const WEEK_MIN_LANE_WIDTH = 36;
export const WEEK_ALL_DAY_ROW_HEIGHT = 44;

export function getWeekAllDayLaneLimit(availableHeight: number): number {
  return Math.min(2, Math.max(0, Math.floor(availableHeight / 3 / WEEK_ALL_DAY_ROW_HEIGHT)));
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

export function createWeekStripLayout(strip: readonly TwoDayViewModel[], scale: number, columnWidth: number, availableHeight: number, bufferDays: number) {
  const timeline = strip.map((day) => createWeekTimelineLayout(day.timelineItems, scale, columnWidth));
  const allDayLayout = createTwoDayAllDayLayout(strip, getWeekAllDayLaneLimit(availableHeight));
  const visibleSegments = allDayLayout.segments.filter((segment) => segment.startIndex < bufferDays + 7 && segment.startIndex + segment.spanDays > bufferDays);
  const usedLanes = Math.max(0, ...visibleSegments.map((segment) => segment.lane + 1));
  const hiddenCounts = strip.map((day, index) => {
    const visibleIds = new Set(allDayLayout.segments.filter((segment) => index >= segment.startIndex && index < segment.startIndex + segment.spanDays).map((segment) => segment.id));
    return new Set([...day.allDayItems.filter((item) => !visibleIds.has(item.id)).map((item) => item.id), ...timeline[index].hiddenIds]).size;
  });
  return {
    allDayLayout,
    allDayHeight: usedLanes === 0 ? Math.min(30, Math.max(0, availableHeight / 3)) : usedLanes * WEEK_ALL_DAY_ROW_HEIGHT,
    strip: strip.map((day, index) => ({ ...day, timelineItems: timeline[index].items })),
    hiddenCounts,
  };
}
