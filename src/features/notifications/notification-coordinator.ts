import {
  NOTIFICATION_PREFIX,
  type NotificationDevice,
  type NotificationRepository,
  type NotificationPermission,
} from '@/domain/notifications/ports';
import { planNotifications } from '@/domain/notifications/notification-plan';
export type NotificationState = Readonly<{
  status: 'idle' | 'syncing' | 'ready' | 'error';
  hasReminders: boolean;
  permission: NotificationPermission;
  deferred: boolean;
  through: number | null;
  error: string | null;
}>;
/** DBとOSを原子的には更新できないため、単一キューとrevision照合で最終状態を回復する。 */
export class NotificationCoordinator {
  private state: NotificationState = {
    status: 'idle',
    hasReminders: false,
    permission: 'undetermined',
    deferred: false,
    through: null,
    error: null,
  };
  private listeners = new Set<() => void>();
  private running: Promise<void> | null = null;
  private permissionRequest: Promise<void> | null = null;
  private generation = 0;
  private dirty = false;
  constructor(
    private readonly repository: NotificationRepository,
    readonly device: NotificationDevice,
    private readonly now = () => new Date(),
  ) {}
  getState = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private setState(patch: Partial<NotificationState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }
  reconcile = (): Promise<void> => {
    this.generation++;
    this.dirty = true;
    if (!this.running)
      this.running = this.drain().finally(() => {
        this.running = null;
      });
    return this.running;
  };
  requestPermission(): Promise<void> {
    if (!this.permissionRequest)
      this.permissionRequest = this.requestPermissionOnce().finally(() => {
        this.permissionRequest = null;
      });
    return this.permissionRequest;
  }
  private async requestPermissionOnce(): Promise<void> {
    try {
      await this.device.requestPermission();
      await this.reconcile();
    } catch {
      this.setState({ status: 'error', error: 'permission_failed' });
    }
  }
  private async drain() {
    while (this.dirty) {
      this.dirty = false;
      const generation = this.generation;
      this.setState({ status: 'syncing', error: null });
      try {
        const permission = await this.device.permission();
        if (generation !== this.generation) continue;
        this.setState({ permission });
        if (permission === 'unsupported') {
          this.setState({ status: 'ready' });
          continue;
        }
        // snapshotが読めなければ、期待集合を空とみなして既存予約を消さない。
        const snapshot = await this.repository.readSnapshot();
        this.setState({
          hasReminders: snapshot.aggregates.some((a) => a.reminders.length > 0),
        });
        const plan = planNotifications(snapshot, this.now());
        const allowed = permission === 'granted' || permission === 'quiet';
        const desired = allowed ? plan.requests : [];
        const stale = async () => {
          if (
            generation !== this.generation ||
            (await this.repository.getRevision()) !== snapshot.revision
          ) {
            this.dirty = true;
            return true;
          }
          return false;
        };
        if (await stale()) continue;
        const current = await this.device.list();
        let aborted = false;
        for (const actual of current.filter((r) =>
          r.identifier.startsWith(NOTIFICATION_PREFIX),
        )) {
          if (await stale()) {
            aborted = true;
            break;
          }
          const expected = desired.find(
            (r) => r.identifier === actual.identifier,
          );
          if (
            !expected ||
            expected.fingerprint !== actual.fingerprint ||
            expected.fireAt !== actual.fireAt
          )
            await this.device.cancel(actual.identifier);
        }
        if (aborted) continue;
        for (const request of desired) {
          if (await stale()) {
            aborted = true;
            break;
          }
          if (request.fireAt <= this.now().getTime()) continue;
          if (
            !current.some(
              (r) =>
                r.identifier === request.identifier &&
                r.fingerprint === request.fingerprint &&
                r.fireAt === request.fireAt,
            )
          )
            await this.device.schedule(request);
        }
        if (aborted || (await stale())) continue;
        const actual = await this.device.list();
        if (await stale()) continue;
        const future = desired.filter((r) => r.fireAt > this.now().getTime());
        if (
          future.some(
            (r) =>
              !actual.some(
                (a) =>
                  a.identifier === r.identifier &&
                  a.fingerprint === r.fingerprint &&
                  a.fireAt === r.fireAt,
              ),
          ) ||
          actual.some(
            (a) =>
              a.identifier.startsWith(NOTIFICATION_PREFIX) &&
              a.fireAt > this.now().getTime() &&
              !future.some((r) => r.identifier === a.identifier),
          )
        )
          throw new Error('readback_failed');
        if (allowed && plan.failures.length > 0) throw new Error('plan_failed');
        if (
          allowed &&
          !(await this.repository.markApplied(
            snapshot.revision,
            this.now().toISOString(),
          ))
        ) {
          this.dirty = true;
          continue;
        }
        this.setState({
          status: 'ready',
          error: null,
          deferred: allowed && plan.deferred,
          through: future.at(-1)?.fireAt ?? null,
        });
      } catch {
        try {
          await this.repository.recordFailure('sync_failed');
        } catch {
          /* DB復旧後も次回の全照合で回復できる。 */
        }
        if (generation === this.generation)
          this.setState({ status: 'error', error: 'sync_failed' });
      }
    }
  }
}
