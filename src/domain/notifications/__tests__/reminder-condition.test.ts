import { sameReminderCondition } from '../reminder-timing';
test('通知条件は保存表現やプロパティ順序ではなく基準と差分で比較する', () => {
  const legacy = {
    version: 1,
    kind: 'legacyStartOffset',
    minutesBefore: 30,
  } as const;
  const start = {
    anchor: 'start',
    minutesBefore: 30,
    kind: 'relativeMinutes',
    version: 1,
  } as const;
  expect(sameReminderCondition(legacy, start, 'exact')).toBe(true);
  expect(sameReminderCondition(legacy, start, 'fuzzy_day')).toBe(true);
  expect(
    sameReminderCondition(legacy, { ...start, anchor: 'end' }, 'exact'),
  ).toBe(false);
  expect(sameReminderCondition(legacy, start, 'fuzzy_period')).toBe(false);
});
