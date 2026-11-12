import { NotificationResponseQueue } from '../notification-response-queue';
describe('通知起動の待機キュー', () => {
  test('準備前のcold startを保留し、同じresponseで二度遷移しない', async () => {
    const opened: unknown[] = [],
      ack = jest.fn();
    const queue = new NotificationResponseQueue(
      { getById: async () => ({ event: { recurrenceRule: null } }) } as never,
      (t) => {
        opened.push(t);
      },
      () => {},
    );
    const r = { id: 'r', data: { version: 1, eventId: 'e' }, acknowledge: ack };
    queue.receive(r);
    await queue.flush();
    expect(opened).toEqual([]);
    queue.setReady(true);
    await queue.flush();
    queue.receive(r);
    await queue.flush();
    expect(opened).toEqual([{ eventId: 'e' }]);
    expect(ack).toHaveBeenCalledTimes(1);
  });
  test('移動開催は元の日付で開き、削除済み対象はカレンダーへ戻す', async () => {
    const opened: unknown[] = [];
    const queue = new NotificationResponseQueue(
      {
        getOccurrenceEditData: async () => ({
          exception: { kind: 'replaced' },
        }),
        getById: async () => null,
      } as never,
      (t) => {
        opened.push(t);
      },
      () => {},
    );
    queue.setReady(true);
    queue.receive({
      id: 'm',
      data: { version: 1, eventId: 'series', occurrenceDate: '2026-11-13' },
      acknowledge: async () => {},
    });
    await queue.flush();
    queue.receive({
      id: 'd',
      data: { version: 1, eventId: 'deleted' },
      acknowledge: async () => {},
    });
    await queue.flush();
    expect(opened).toEqual([
      { eventId: 'series', occurrenceDate: '2026-11-13' },
      null,
    ]);
  });
});
