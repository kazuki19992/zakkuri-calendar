import type { EventRepository } from '@/domain/calendar/repositories';
import type { NotificationTarget } from '@/domain/notifications/ports';
import type { NotificationResponse } from '@/data/notifications/notification-device';
import {
  parseNotificationTarget,
  resolveNotificationTarget,
} from './notification-target';
/** cold startの受信はrouter準備まで保留し、DB失敗では消費せず次の復帰で再試行する。 */
export class NotificationResponseQueue {
  private ready = false;
  private pending: NotificationResponse[] = [];
  private seen = new Set<string>();
  private running: Promise<void> | null = null;
  constructor(
    private readonly repository: Pick<
      EventRepository,
      'getById' | 'getOccurrenceEditData'
    >,
    private readonly navigate: (target: NotificationTarget | null) => void,
    private readonly onError: () => void,
  ) {}
  receive(response: NotificationResponse) {
    if (
      this.seen.has(response.id) ||
      this.pending.some((r) => r.id === response.id)
    )
      return;
    this.pending.push(response);
    void this.flush();
  }
  setReady(ready: boolean) {
    this.ready = ready;
    if (ready) void this.flush();
  }
  flush(): Promise<void> {
    if (!this.running)
      this.running = this.drain().finally(() => {
        this.running = null;
      });
    return this.running;
  }
  private async drain() {
    while (this.ready && this.pending.length) {
      const response = this.pending[0];
      try {
        const target = parseNotificationTarget(response.data);
        const resolved = target
          ? await resolveNotificationTarget(target, this.repository)
          : null;
        if (!this.ready) return;
        if (target) this.navigate(resolved);
        this.pending.shift();
        this.seen.add(response.id);
        if (this.seen.size > 100)
          this.seen.delete(this.seen.values().next().value!);
        // OS側のack失敗だけで同じ画面へ再遷移しない。
        try {
          await response.acknowledge();
        } catch {
          /* 次回起動の実体確認へ委ねる。 */
        }
      } catch {
        this.onError();
        return;
      }
    }
  }
}
