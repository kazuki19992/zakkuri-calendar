import { createWeekStripLayout, createWeekTimelineLayout, formatWeekRange, getWeekAllDayLaneLimit, getWeekHeaderHeight } from '../week-view-layout';
import type { TwoDayViewModel } from '../two-day-view-model';
import { offsetCalendarDate } from '@/domain/calendar/month';
import { getTimelineItemFrame, TIMELINE_HEIGHT, type TimelineItemViewModel } from '../timeline-layout';

function item(id: string, top: number): TimelineItemViewModel {
  return { id, eventId: 'series', originalOccurrenceDate: '2026-11-05', title: id, colorId: 'red', temporalLabel: '朝',
    accessibilityLabel: id, startMinute: top, endMinute: top + 10, top, height: 10,
    overlapIndex: 0, overlapCount: 1, opacityStops: [{ offset: 0, opacity: 1 }, { offset: 1, opacity: 1 }],
    isInstant: false, continuesFromPreviousDay: false, continuesToNextDay: false };
}
describe('週の密集表示', () => {
  it('予備週だけの衝突では表示週の空いている終日レーンを隠さない', () => {
    const ranges = [['a', '2026-10-17', '2026-11-01'], ['b', '2026-10-17', '2026-11-01'], ['c', '2026-10-31', '2026-11-04']];
    const strip: TwoDayViewModel[] = Array.from({ length: 21 }, (_, index) => {
      const date = offsetCalendarDate('2026-10-26', index);
      return { date, dateLabel: date, weekdayLabel: '月', isToday: false, holidayName: null, holidaySupport: 'available', accessibilityLabel: date, timelineItems: [],
        allDayItems: ranges.filter(([, from, through]) => date >= from && date <= through).map(([id, from, through]) => ({
          kind: 'event', id, eventId: id, colorId: 'red', isInteractive: true, title: id, temporalLabel: '終日', accessibilityLabel: id,
          rangeStartDate: from, rangeThroughDate: through, rangePosition: date === from ? 'start' : date === through ? 'end' : 'middle',
        })) };
    });
    const result = createWeekStripLayout(strip, 1, 40, 600, 7);
    expect(result.hiddenCounts.slice(7, 10)).toEqual([0, 0, 0]);
    expect(result.allDayLayout.segments.some((segment) => segment.item.id === 'c' && segment.startIndex === 7)).toBe(true);
  });
  it('文字拡大で本文が低くても時間軸の領域を残す', () => {
    const height = getWeekHeaderHeight(160, 2);
    const strip: TwoDayViewModel[] = [{ date: '2026-11-05', dateLabel: '11月5日', weekdayLabel: '木', isToday: false, holidayName: null,
      holidaySupport: 'available', accessibilityLabel: '木', timelineItems: [], allDayItems: [] }];
    expect(160 - height - createWeekStripLayout(strip, 1, 40, 160, 0, false, height).allDayHeight).toBeGreaterThanOrEqual(44);
  });
  it('終日と時刻の省略を重複なく数え、高さ不足では終日を全件省略する', () => {
    const day: TwoDayViewModel = { date: '2026-11-05', dateLabel: '11月5日', weekdayLabel: '木', isToday: false,
      holidayName: null, holidaySupport: 'available', accessibilityLabel: '木曜日', timelineItems: [item('a', 100), item('b', 100)],
      allDayItems: [{ kind: 'event', id: 'b', eventId: 'b', colorId: 'red', isInteractive: true, title: 'b', temporalLabel: '終日', accessibilityLabel: 'b' }] };
    const result = createWeekStripLayout([day], 1, 40, 100, 0);
    expect(result.hiddenCounts).toEqual([1]);
    expect(result.allDayHeight).toBeLessThanOrEqual(100 / 3);
    expect(result.allDayLayout.segments).toEqual([]);
  });
  it('週を進めても保存済み期間に沿うフェードと期間途中の形を維持する', () => {
    const makeStrip = (start: string): readonly TwoDayViewModel[] => Array.from({ length: 21 }, (_, index) => {
      const date = offsetCalendarDate(start, index);
      return { date, dateLabel: date, weekdayLabel: '木', isToday: false, holidayName: null, holidaySupport: 'available',
        accessibilityLabel: date, timelineItems: [], allDayItems: date >= '2026-11-01' && date <= '2026-11-14' ? [{
          kind: 'fuzzyRange', id: 'range', eventId: 'range', colorId: 'red', isInteractive: true, title: '期間', temporalLabel: 'ざっくり', accessibilityLabel: '期間',
          rangeStartDate: '2026-11-01', rangeThroughDate: '2026-11-14', rangePosition: date === '2026-11-01' ? 'start' : date === '2026-11-14' ? 'end' : 'middle',
          fadeInRatio: 1, fadeOutRatio: 0,
        }] : [] };
    });
    const before = createWeekStripLayout(makeStrip('2026-10-26'), 1, 40, 600, 7).allDayLayout.segments[0];
    const afterLayout = createWeekStripLayout(makeStrip('2026-11-02'), 1, 40, 600, 7).allDayLayout;
    const after = afterLayout.segments[0];
    expect(before.opacityStops[0].opacity).toBe(0);
    expect(after.opacityStops[0].opacity).toBeGreaterThan(0);
    expect(afterLayout.segments.at(-1)?.opacityStops.at(-1)?.opacity).toBe(1);
    expect(after.startsAtRangeStart).toBe(false);
  });
  it('空週の静止時は最小高とし、移動中は次週の2レーンも確保する', () => {
    const strip: TwoDayViewModel[] = Array.from({ length: 21 }, (_, index) => ({
      date: offsetCalendarDate('2026-10-26', index), dateLabel: '日', weekdayLabel: '月', isToday: false, holidayName: null,
      holidaySupport: 'available', accessibilityLabel: '日', timelineItems: [], allDayItems: index >= 14 ? ['a', 'b'].map((id) => ({
        kind: 'event', id, eventId: id, colorId: 'red', isInteractive: true, title: id, temporalLabel: '終日', accessibilityLabel: id,
      })) : [],
    }));
    expect(createWeekStripLayout(strip, 1, 40, 600, 7, false).allDayHeight).toBe(30);
    expect(createWeekStripLayout(strip, 1, 40, 600, 7, true).allDayHeight).toBe(88);
  });
  it('縮小後の最小高で衝突する予定を省略し、拡大すると再表示する', () => {
    const values = [item('a', 100), item('b', 200)];
    expect(createWeekTimelineLayout(values, 0.25, 45).hiddenIds).toEqual(['b']);
    expect(createWeekTimelineLayout(values, 1, 45).items.map((value) => value.id)).toEqual(['a', 'b']);
  });
  it('広い列は最大2レーンで、入力順が違っても安定した予定を表示する', () => {
    const layout = createWeekTimelineLayout([item('c', 100), item('b', 100), item('a', 100)], 1, 80);
    expect(layout.items.map((value) => [value.id, value.overlapIndex, value.overlapCount])).toEqual([['a', 0, 2], ['b', 1, 2]]);
    expect(layout.hiddenIds).toEqual(['c']);
    expect(layout.items[0].originalOccurrenceDate).toBe('2026-11-05');
  });
  it('下端へ寄せた最小高の矩形同士も衝突として扱う', () => {
    const values = [item('a', TIMELINE_HEIGHT - 3), item('b', TIMELINE_HEIGHT - 1)];
    expect(getTimelineItemFrame(values[0], 0.5)).toEqual({ top: TIMELINE_HEIGHT * 0.5 - 36, height: 36 });
    expect(createWeekTimelineLayout(values, 0.5, 40).hiddenIds).toEqual(['b']);
  });
  it('省略した長い予定で後のレーンを塞がない', () => {
    const values = [item('a', 0), { ...item('b', 5), height: 300 }, item('c', 50)];
    expect(createWeekTimelineLayout(values, 1, 40).items.map((value) => value.id)).toEqual(['a', 'c']);
  });
  it.each([[600, 2], [200, 1], [100, 0]])('本文高%sの3分の1に44ptレーンを収める', (height, expected) => {
    expect(getWeekAllDayLaneLimit(height)).toBe(expected);
  });
  it('年をまたぐ週範囲だけ両端の年を表示する', () => {
    expect(formatWeekRange('2026-11-02', '2026-11-08')).toBe('11月2日〜11月8日');
    expect(formatWeekRange('2026-12-28', '2027-01-03')).toBe('2026年12月28日〜2027年1月3日');
  });
});
