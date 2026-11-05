import { createWeekTimelineLayout, formatWeekRange, getWeekAllDayLaneLimit } from '../week-view-layout';
import { getTimelineItemFrame, TIMELINE_HEIGHT, type TimelineItemViewModel } from '../timeline-layout';

function item(id: string, top: number): TimelineItemViewModel {
  return { id, eventId: 'series', originalOccurrenceDate: '2026-11-05', title: id, colorId: 'red', temporalLabel: '朝',
    accessibilityLabel: id, startMinute: top, endMinute: top + 10, top, height: 10,
    overlapIndex: 0, overlapCount: 1, opacityStops: [{ offset: 0, opacity: 1 }, { offset: 1, opacity: 1 }],
    isInstant: false, continuesFromPreviousDay: false, continuesToNextDay: false };
}
describe('週の密集表示', () => {
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
