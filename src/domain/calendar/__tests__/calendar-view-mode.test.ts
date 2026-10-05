import {
  DEFAULT_CALENDAR_VIEW_MODE,
  parseCalendarViewMode,
} from '../calendar-view-mode';

describe('カレンダー表示モード', () => {
  it.each(['twoDay', 'month'] as const)('既知の表示モード%sを受け入れる', (value) => {
    expect(parseCalendarViewMode(value)).toBe(value);
  });

  it.each([undefined, null, 'week', 2, {}, []])('不正値%pを拒否する', (value) => {
    expect(parseCalendarViewMode(value)).toBeNull();
  });

  it('既定値は2日表示にする', () => {
    expect(DEFAULT_CALENDAR_VIEW_MODE).toBe('twoDay');
  });
});
