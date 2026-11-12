import { NotificationCoordinator } from '../notification-coordinator';
import type {
  NotificationDevice,
  NotificationRepository,
  NotificationSnapshot,
  DeviceNotification,
  NotificationPermission,
} from '@/domain/notifications/ports';
import { NOTIFICATION_PREFIX } from '@/domain/notifications/ports';
import type { CalendarEvent } from '@/domain/calendar/event';
const event: CalendarEvent = {
  id: 'e',
  calendarId: 'c',
  title: '予定',
  anchorDate: '2026-11-13',
  temporalType: 'exact',
  startTime: '12:00',
  duration: { type: 'fixed', minutes: 60 },
  location: null,
  noteDocument: null,
  colorId: null,
  recurrenceRule: null,
  createdTimeZoneId: 'Asia/Tokyo',
  createdAt: '',
  updatedAt: '',
};
function environment() {
  let snapshot: NotificationSnapshot = {
    revision: 1,
    aggregates: [
      {
        event,
        reminders: [{ id: 'r', eventId: 'e', sortOrder: 0, minutesBefore: 10 }],
      },
    ],
    exceptions: [],
    definitions: [],
  };
  const os = new Map<string, DeviceNotification>();
  let permission: NotificationPermission = 'granted',
    applied = 0;
  const repo: NotificationRepository = {
    readSnapshot: async () => snapshot,
    getRevision: async () => snapshot.revision,
    markApplied: async (r) => {
      if (r !== snapshot.revision) return false;
      applied = r;
      return true;
    },
    recordFailure: async () => {},
  };
  const device: NotificationDevice = {
    permission: async () => permission,
    requestPermission: async () => {
      permission = 'granted';
      return permission;
    },
    list: async () => [...os.values()],
    schedule: async (r) => {
      os.set(r.identifier, r);
    },
    cancel: async (id) => {
      os.delete(id);
    },
    openSettings: async () => {},
    openAlarmSettings: async () => {},
  };
  const coordinator = new NotificationCoordinator(
    repo,
    device,
    () => new Date(2026, 10, 12),
  );
  return {
    coordinator,
    device,
    repo,
    os,
    applied: () => applied,
    change: () => {
      snapshot = { ...snapshot, revision: 2, aggregates: [] };
    },
    deny: () => {
      permission = 'denied';
    },
  };
}
describe('通知の整合同期', () => {
  test('再実行で重複せず削除後は所有予約だけを取消す', async () => {
    const e = environment();
    e.os.set('other', { identifier: 'other', fireAt: 0, fingerprint: '' });
    await e.coordinator.reconcile();
    await e.coordinator.reconcile();
    expect(e.os.size).toBe(2);
    expect(e.applied()).toBe(1);
    e.change();
    await e.coordinator.reconcile();
    expect([...e.os.keys()]).toEqual(['other']);
    expect(e.applied()).toBe(2);
  });
  test('同期中に削除されても古い予約を残して成功しない', async () => {
    const e = environment(),
      schedule = e.device.schedule;
    e.device.schedule = async (r) => {
      await schedule(r);
      e.change();
    };
    await e.coordinator.reconcile();
    expect(e.os.size).toBe(0);
    expect(e.applied()).toBe(2);
  });
  test('予約API成功でも読戻しに存在しなければ未予約エラー', async () => {
    const e = environment();
    e.device.schedule = async () => {};
    await e.coordinator.reconcile();
    expect(e.coordinator.getState().status).toBe('error');
    expect(e.applied()).toBe(0);
  });
  test('読込失敗時に期待集合を空と誤認して取消さない', async () => {
    const e = environment();
    await e.coordinator.reconcile();
    e.repo.readSnapshot = async () => {
      throw Error('private');
    };
    await e.coordinator.reconcile();
    expect(e.os.size).toBe(1);
    expect(e.coordinator.getState().status).toBe('error');
  });
  test('拒否と再許可で保存済み設定を維持して今後の分だけ回復する', async () => {
    const e = environment();
    await e.coordinator.reconcile();
    e.deny();
    await e.coordinator.reconcile();
    expect(e.os.size).toBe(0);
    expect(e.coordinator.getState().permission).toBe('denied');
    await e.coordinator.requestPermission();
    expect(e.os.size).toBe(1);
  });
  test('取消失敗は保存失敗と混同せず再試行できる', async () => {
    const e = environment();
    await e.coordinator.reconcile();
    e.change();
    const cancel = e.device.cancel;
    e.device.cancel = async () => {
      throw Error('private');
    };
    await e.coordinator.reconcile();
    expect(e.coordinator.getState().error).toBe('sync_failed');
    expect(e.applied()).toBe(1);
    e.device.cancel = cancel;
    await e.coordinator.reconcile();
    expect(e.applied()).toBe(2);
    expect(
      [...e.os.keys()].filter((id) => id.startsWith(NOTIFICATION_PREFIX)),
    ).toEqual([]);
  });
});

test('通知許可を連打しても同時に複数のOS要求を開始しない', async () => {
  const e = environment();
  let finish!: () => void,
    calls = 0;
  e.device.requestPermission = () => {
    calls++;
    return new Promise((resolve) => {
      finish = () => resolve('granted');
    });
  };
  const first = e.coordinator.requestPermission(),
    second = e.coordinator.requestPermission();
  expect(calls).toBe(1);
  finish();
  await first;
  await second;
});
