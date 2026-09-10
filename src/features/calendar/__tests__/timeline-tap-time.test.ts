import { HOUR_HEIGHT } from '../timeline-layout';
import { resolveNearestTimelineHour } from '../timeline-tap-time';

describe('タイムラインのダブルタップ時刻解決', () => {
  it.each([
    [0, '00:00'],
    [29, '00:00'],
    [30, '01:00'],
    [23 * 60 + 59, '23:00'],
  ])('%i分の位置を最も近い正時へ丸める', (minutes, expected) => {
    const y = (minutes / 60) * HOUR_HEIGHT;

    expect(resolveNearestTimelineHour(y, 1)).toBe(expected);
  });
});
