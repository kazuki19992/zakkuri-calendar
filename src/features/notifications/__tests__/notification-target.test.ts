import {
  parseNotificationTarget,
  resolveNotificationTarget,
} from '../notification-target';
describe('通知タップの検証', () => {
  test('任意URLと不正versionをrouteとして扱わない', () => {
    expect(parseNotificationTarget({ url: '/settings' })).toBeNull();
    expect(parseNotificationTarget({ version: 2, eventId: 'e' })).toBeNull();
  });
  test('開催日を検証し存在しない予定では遷移しない', async () => {
    expect(
      parseNotificationTarget({
        version: 1,
        eventId: 'e',
        occurrenceDate: '2026-02-30',
      }),
    ).toBeNull();
    expect(
      await resolveNotificationTarget({ eventId: 'e' }, {
        getById: async () => null,
      } as never),
    ).toBeNull();
  });
});
