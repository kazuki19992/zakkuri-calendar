/** @jest-environment node */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabaseAsync } from 'expo-sqlite';
import {
  openNodeSqliteDatabase,
  openNodeSqliteDatabaseAsync,
} from '@/test/node-sqlite-database';
import { migrateDatabase } from '../migrations';
import { createRepositoryContainer } from '../repository-container';
import { defaultReminderTiming } from '@/domain/notifications/reminder-timing';
import { getReminderTiming } from '@/domain/calendar/event-reminder';
import type { CalendarEvent } from '@/domain/calendar/event';
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
const now = '2026-11-12T00:00:00.000Z';
const event: CalendarEvent = {
  id: 'n',
  calendarId: 'personal-default',
  title: '予定',
  temporalType: 'exact',
  anchorDate: '2026-11-13',
  startTime: '12:00',
  duration: { type: 'fixed', minutes: 60 },
  createdTimeZoneId: 'Asia/Tokyo',
  location: null,
  noteDocument: null,
  colorId: null,
  recurrenceRule: null,
  createdAt: now,
  updatedAt: now,
};
describe('通知の実SQLite保存', () => {
  let dir: string,
    connection: Awaited<ReturnType<typeof openNodeSqliteDatabase>>;
  beforeEach(async () => {
    jest
      .mocked(openDatabaseAsync)
      .mockImplementation(openNodeSqliteDatabaseAsync);
    dir = mkdtempSync(join(tmpdir(), 'zakkuri-notify-'));
    connection = await openNodeSqliteDatabase(join(dir, 'test.db'));
    await migrateDatabase(connection.database, {
      now: () => now,
      timeZoneId: () => 'Asia/Tokyo',
    });
  });
  afterEach(async () => {
    await connection.close();
    rmSync(dir, { recursive: true, force: true });
  });
  test('4種類の初期値と明示通知なしを保持し既存予定へ遡及しない', async () => {
    const r = createRepositoryContainer(connection.database);
    expect(await r.settings.getNotificationDefault('exact')).toEqual({
      version: 1,
      kind: 'relativeMinutes',
      anchor: 'start',
      minutesBefore: 10,
    });
    await r.events.create({ event, reminders: [] });
    const before = await r.notifications.getRevision();
    await r.settings.setNotificationDefault('exact', null, now);
    expect(await r.settings.getNotificationDefault('exact')).toBeNull();
    expect((await r.events.getById('n'))?.reminders).toEqual([]);
    expect(await r.notifications.getRevision()).toBe(before);
  });
  test('新しい基準を再読込みし保存・削除でrevisionが進みFKで通知も消える', async () => {
    const r = createRepositoryContainer(connection.database);
    await r.events.create({
      event,
      reminders: [
        {
          id: 'r',
          eventId: 'n',
          sortOrder: 0,
          timing: defaultReminderTiming('exact'),
        },
      ],
    });
    const snapshot = await r.notifications.readSnapshot();
    expect(snapshot.revision).toBe(1);
    expect(getReminderTiming(snapshot.aggregates[0].reminders[0])).toEqual({
      version: 1,
      kind: 'relativeMinutes',
      anchor: 'start',
      minutesBefore: 10,
    });
    expect(await r.notifications.markApplied(0, now)).toBe(false);
    expect(await r.notifications.markApplied(1, now)).toBe(true);
    await r.events.delete('n');
    expect(await r.notifications.getRevision()).toBe(2);
    expect((await r.notifications.readSnapshot()).aggregates).toEqual([]);
    expect(
      await connection.database.all('SELECT * FROM event_reminders'),
    ).toEqual([]);
  });
  test('旧schema6の通知をID・順序・大きな分数ごと保持して移行し再実行できる', async () => {
    const db = connection.database;
    await db.exec(
      'DROP TABLE event_reminders; DELETE FROM schema_migrations WHERE version = 7; CREATE TABLE event_reminders(id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE, minutes_before INTEGER NOT NULL, sort_order INTEGER NOT NULL, UNIQUE(event_id,minutes_before));',
    );
    await db.run(
      `INSERT INTO events (id,calendar_id,title,temporal_type,anchor_date,start_time,duration_type,duration_minutes,created_time_zone_id,created_at,updated_at) VALUES ('old','personal-default','旧予定','exact','2026-11-13','12:00','fixed',60,'Asia/Tokyo',$now,$now)`,
      { $now: now },
    );
    await db.exec(
      "INSERT INTO event_reminders VALUES ('old-r','old',1000000,3)",
    );
    await migrateDatabase(db, {
      now: () => now,
      timeZoneId: () => 'Asia/Tokyo',
    });
    await migrateDatabase(db, {
      now: () => now,
      timeZoneId: () => 'Asia/Tokyo',
    });
    const a = await createRepositoryContainer(db).events.getById('old');
    expect(a?.reminders[0]).toMatchObject({ id: 'old-r', sortOrder: 3 });
    expect(getReminderTiming(a!.reminders[0])).toEqual({
      version: 1,
      kind: 'legacyStartOffset',
      minutesBefore: 1000000,
    });
  });
  test('不正な設定はその項目だけ初期値へ戻りDBを変更しない', async () => {
    const db = connection.database,
      r = createRepositoryContainer(db);
    await db.run(
      'INSERT INTO app_settings(key,value_json,updated_at) VALUES ($key,$json,$now)',
      {
        $key: 'notification_default_exact',
        $json: '{"version":99}',
        $now: now,
      },
    );
    expect(await r.settings.getNotificationDefault('exact')).toEqual(
      defaultReminderTiming('exact'),
    );
    expect(
      (
        await db.first<{ value_json: string }>(
          "SELECT value_json FROM app_settings WHERE key='notification_default_exact'",
        )
      )?.value_json,
    ).toBe('{"version":99}');
  });
});
