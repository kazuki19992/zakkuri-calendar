import type { EventAggregate } from '@/domain/calendar/event-reminder';
import type { RecurrenceException } from '@/domain/calendar/recurrence-exception';
import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';
export type NotificationSnapshot = Readonly<{
  revision: number;
  aggregates: readonly EventAggregate[];
  exceptions: readonly RecurrenceException[];
  definitions: readonly TemporalDefinition[];
}>;
export type NotificationTarget = Readonly<{
  eventId: string;
  occurrenceDate?: string;
}>;
export type PlannedNotification = Readonly<{
  identifier: string;
  key: string;
  fingerprint: string;
  fireAt: number;
  title: string;
  label: string;
  target: NotificationTarget;
}>;
export type NotificationPermission =
  | 'granted'
  | 'quiet'
  | 'denied'
  | 'undetermined'
  | 'unsupported';
export type DeviceNotification = Readonly<{
  identifier: string;
  fireAt: number;
  fingerprint: string;
}>;
export interface NotificationRepository {
  readSnapshot(): Promise<NotificationSnapshot>;
  getRevision(): Promise<number>;
  markApplied(revision: number, now: string): Promise<boolean>;
  recordFailure(code: string): Promise<void>;
}
export interface NotificationDevice {
  permission(): Promise<NotificationPermission>;
  requestPermission(): Promise<NotificationPermission>;
  list(): Promise<readonly DeviceNotification[]>;
  schedule(request: PlannedNotification): Promise<void>;
  cancel(identifier: string): Promise<void>;
  openSettings(): Promise<void>;
  openAlarmSettings(): Promise<void>;
}
export const NOTIFICATION_PREFIX = 'zakkuri.reminder.v1.';
