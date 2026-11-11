/** @jest-environment node */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CalendarEvent } from '@/domain/calendar/event';
import type { AppDatabase } from '../database';
import { openNodeSqliteDatabase, openNodeSqliteDatabaseAsync } from '@/test/node-sqlite-database';
import { openDatabaseAsync } from 'expo-sqlite';

import { migrateDatabase, LATEST_SCHEMA_VERSION } from '../migrations';
import { createRepositoryContainer } from '../repository-container';
import { createLegacySchema } from '@/test/fixtures/sqlite-legacy-schema';
import { expandEventOccurrences } from '@/domain/calendar/event-occurrence';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

const now = '2026-11-12T00:00:00.000Z';
const environment = { now: () => now, timeZoneId: () => 'Asia/Tokyo' };
const event: CalendarEvent = {
  id: 'synthetic-event', calendarId: 'personal-default', title: '検証予定',
  temporalType: 'exact', anchorDate: '2026-12-31', startTime: '23:00',
  duration: { type: 'fixed', minutes: 180 }, location: '検証場所', colorId: 'teal',
  noteDocument: { version: 1, blocks: [
    { type: 'paragraph', content: [{ text: '合成メモ', bold: true, link: 'https://example.com/' }] },
    { type: 'checkList', items: [{ checked: true, content: [{ text: '確認済み' }] }] },
  ] },
  recurrenceRule: null, createdTimeZoneId: 'Asia/Tokyo', createdAt: now, updatedAt: now,
};
const aggregate = { event, reminders: [{ id: 'reminder', eventId: event.id, minutesBefore: 90, sortOrder: 0 }] };

describe('実SQLiteによるMVP保存回帰', () => {
  let directory: string;
  let connection: Awaited<ReturnType<typeof openNodeSqliteDatabase>>;
  let database: AppDatabase;
  beforeEach(async () => {
    jest.mocked(openDatabaseAsync).mockImplementation(openNodeSqliteDatabaseAsync);
    directory = mkdtempSync(join(tmpdir(), 'zakkuri-test-'));
    connection = await openNodeSqliteDatabase(join(directory, 'synthetic.db'));
    database = connection.database;
  });
  afterEach(async () => {
    await connection.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it('初期化を繰り返してもseedや変更した設定を上書きしない', async () => {
    await migrateDatabase(database, environment);
    const repositories = createRepositoryContainer(database);
    const definitions = await repositories.temporalDefinitions.listEnabled('personal-default');
    expect(definitions.length).toBeGreaterThan(0);
    await repositories.settings.setDefaultExactDuration({ type: 'fixed', minutes: 45 }, now);
    await repositories.calendars.setColor('personal-default', 'teal', now);
    await migrateDatabase(database, environment);
    expect(await repositories.temporalDefinitions.listEnabled('personal-default')).toEqual(definitions);
    expect(await repositories.settings.getDefaultExactDuration()).toEqual({ type: 'fixed', minutes: 45 });
    expect(await repositories.calendars.getDefault()).toMatchObject({ colorId: 'teal' });
    expect(await database.first('SELECT COUNT(*) AS count FROM schema_migrations')).toEqual({ count: LATEST_SCHEMA_VERSION });
    expect(await database.all('PRAGMA foreign_key_check')).toEqual([]);
    expect(await database.first('PRAGMA integrity_check')).toEqual({ integrity_check: 'ok' });
  });

  it('再接続後も予定・書式付きメモ・通知・表示設定を復元し編集と削除ができる', async () => {
    await migrateDatabase(database, environment);
    let repositories = createRepositoryContainer(database);
    await repositories.events.create(aggregate);
    await repositories.settings.setLastEventEditorTab('exact', now);
    await repositories.settings.setLastCalendarViewMode('week', now);
    await repositories.settings.setCalendarWeekStartsOn(0, now);
    await repositories.settings.setCalendarVisible('personal-default', false, now);
    await connection.close();
    connection = await openNodeSqliteDatabase(join(directory, 'synthetic.db'));
    database = connection.database;
    await migrateDatabase(database, environment);
    repositories = createRepositoryContainer(database);
    expect(await repositories.events.getById(event.id)).toEqual(aggregate);
    expect(await repositories.settings.getLastEventEditorTab()).toBe('exact');
    expect(await repositories.settings.getLastCalendarViewMode()).toBe('week');
    expect(await repositories.settings.getCalendarWeekStartsOn()).toBe(0);
    expect(await repositories.settings.getCalendarVisible('personal-default')).toBe(false);
    await repositories.events.update({ ...aggregate, event: { ...event, title: '変更後' } });
    expect(await repositories.events.getById(event.id)).toMatchObject({ event: { title: '変更後' } });
    await repositories.events.delete(event.id);
    expect(await repositories.events.getById(event.id)).toBeNull();
    expect(await database.all('SELECT * FROM event_reminders')).toEqual([]);
  });

  it('通知のSQL書込み失敗では変更前の予定と通知へrollbackして再試行できる', async () => {
    await migrateDatabase(database, environment);
    const repositories = createRepositoryContainer(database);
    await repositories.events.create(aggregate);
    await database.exec(`CREATE TRIGGER fail_reminder BEFORE INSERT ON event_reminders
      BEGIN SELECT RAISE(ABORT, 'synthetic write failure'); END;`);
    await expect(repositories.events.update({ ...aggregate, event: { ...event, title: '保存失敗' } }))
      .rejects.toThrow('synthetic write failure');
    expect(await repositories.events.getById(event.id)).toEqual(aggregate);
    await database.exec('DROP TRIGGER fail_reminder');
    await repositories.events.update({ ...aggregate, event: { ...event, title: '再試行成功' } });
    expect(await repositories.events.getById(event.id)).toMatchObject({ event: { title: '再試行成功' } });
  });

  it('外部キー制約が初期化後も有効で不整合な予定を保存しない', async () => {
    await migrateDatabase(database, environment);
    const repositories = createRepositoryContainer(database);
    await expect(repositories.events.create({ ...aggregate, event: { ...event, calendarId: 'missing' } }))
      .rejects.toThrow(/FOREIGN KEY/);
    expect(await repositories.events.getById(event.id)).toBeNull();
    expect(await database.first('PRAGMA foreign_keys')).toEqual({ foreign_keys: 1 });
  });

  it.each([1, 2, 3, 4, 5])('version %iの旧DBを予定とメモを失わず移行できる', async (version) => {
    await createLegacySchema(database, version);
    await database.run(`INSERT INTO calendars (id, name, time_zone_id, created_at, updated_at)
      VALUES ('personal-default', '検証', 'Asia/Tokyo', $now, $now)`, { $now: now });
    await database.run(`INSERT INTO temporal_definitions VALUES
      ('legacy-morning', 'personal-default', 'morning', '朝', 'day', 'timeOfDay',
       '{"kind":"timeOfDay","startMinute":360,"endMinute":600}', 0.25, 0.25, 1, 1, 10, $now, $now)`, { $now: now });
    for (const type of ['exact', 'allDay', 'fuzzy']) {
      await database.run(`INSERT INTO events
        (id, calendar_id, title, temporal_type, anchor_date, temporal_definition_id, start_time,
         duration_type, duration_minutes, created_time_zone_id, created_at, updated_at)
        VALUES ($type, 'personal-default', '旧予定', $type, '2026-12-31', $definition, $time,
          $duration, $minutes, 'Asia/Tokyo', $now, $now)`, {
        $type: type, $definition: type === 'fuzzy' ? 'legacy-morning' : null,
        $time: type === 'exact' ? '23:00' : null, $duration: type === 'exact' ? 'fixed' : null,
        $minutes: type === 'exact' ? 180 : null, $now: now,
      });
    }
    if (version >= 2) {
      await database.exec(`UPDATE events SET notes = '旧メモ', end_date =
        CASE WHEN temporal_type IN ('allDay', 'fuzzy') THEN '2027-01-02' ELSE NULL END;
        INSERT INTO event_reminders VALUES ('legacy-reminder', 'exact', 90, 0);`);
    }
    if (version >= 3) {
      await database.run(`INSERT INTO temporal_definitions VALUES
        ('legacy-this-week', 'personal-default', 'this_week', '今週中', 'week', 'weekRemainder',
         '{"kind":"weekRemainder","selectionWeekOffset":0}', 0.25, 0.25, 1, 1, 100, $now, $now)`, { $now: now });
    }
    if (version >= 4) {
      await database.run('UPDATE events SET recurrence_rule_json = $rule WHERE id = $id', {
        $rule: JSON.stringify({ version: 1, frequency: 'daily', interval: 1, weekdays: [], end: { type: 'never' } }),
        $id: 'exact',
      });
      await database.run(`INSERT INTO recurrence_exceptions VALUES
        ('exact', '2026-12-31', 'replaced', 'allDay', '["temporal"]', $now, $now)`, { $now: now });
    }
    if (version >= 5) {
      await database.run('UPDATE events SET notes_document_json = $document WHERE id = $id', {
        $document: JSON.stringify(event.noteDocument), $id: 'exact',
      });
    }
    await migrateDatabase(database, environment);
    await migrateDatabase(database, environment);
    const repositories = createRepositoryContainer(database);
    const exact = await repositories.events.getById('exact');
    expect(exact).toMatchObject({ event: { title: '旧予定', duration: { type: 'fixed', minutes: 180 } } });
    expect(exact?.reminders).toHaveLength(version >= 2 ? 1 : 0);
    if (version >= 5) expect(exact?.event.noteDocument).toEqual(event.noteDocument);
    else if (version >= 2) expect(exact?.event.noteDocument).toEqual({
      version: 1, blocks: [{ type: 'paragraph', content: [{ text: '旧メモ' }] }],
    });
    for (const type of ['allDay', 'fuzzy']) {
      expect(await repositories.events.getById(type)).toMatchObject({
        event: { temporalType: type, endDate: version >= 2 ? '2027-01-02' : '2026-12-31' },
      });
    }
    expect(await database.first('SELECT COUNT(*) AS count FROM events')).toEqual({ count: 3 });
    expect(await repositories.temporalDefinitions.getById(version >= 3 ? 'legacy-this-week' : 'personal-default:this_week'))
      .toMatchObject({ fadeInRatio: 1, fadeOutRatio: 0 });
    if (version >= 4) expect(await repositories.events.getOccurrenceEditData({
      seriesEventId: 'exact', originalOccurrenceDate: '2026-12-31',
    })).toMatchObject({ exception: { kind: 'replaced', replacementEventId: 'allDay', overrideFields: ['temporal'] } });
    expect(await database.all('PRAGMA foreign_key_check')).toEqual([]);
    expect(await database.first('SELECT MAX(version) AS version FROM schema_migrations'))
      .toEqual({ version: LATEST_SCHEMA_VERSION });
  });

  it('migration途中の失敗でschemaと履歴をrollbackし外部キーを復旧して再試行できる', async () => {
    await createLegacySchema(database, 1);
    await database.exec(`CREATE TRIGGER fail_migration BEFORE INSERT ON schema_migrations
      WHEN NEW.version = 5 BEGIN SELECT RAISE(ABORT, 'synthetic migration failure'); END;`);
    await expect(migrateDatabase(database, environment)).rejects.toThrow('synthetic migration failure');
    expect(await database.first('SELECT MAX(version) AS version FROM schema_migrations')).toEqual({ version: 1 });
    expect(await database.all<{ name: string }>('PRAGMA table_info(events)'))
      .not.toEqual(expect.arrayContaining([expect.objectContaining({ name: 'notes_document_json' })]));
    expect(await database.first('PRAGMA foreign_keys')).toEqual({ foreign_keys: 1 });
    await database.exec('DROP TRIGGER fail_migration');
    await migrateDatabase(database, environment);
    expect(await database.first('SELECT MAX(version) AS version FROM schema_migrations'))
      .toEqual({ version: LATEST_SCHEMA_VERSION });
  });

  it('繰り返しの個別置換を再接続後に読み出し削除時に置換予定と通知も消す', async () => {
    await migrateDatabase(database, environment);
    let repositories = createRepositoryContainer(database);
    const series: CalendarEvent = { ...event, recurrenceRule: {
      version: 1, frequency: 'daily', interval: 1, weekdays: [], end: { type: 'never' },
    } };
    await repositories.events.create({ ...aggregate, event: series });
    const identity = { seriesEventId: series.id, originalOccurrenceDate: '2027-01-01' };
    const replacement = { ...event, id: 'replacement', anchorDate: '2027-01-02', title: '個別変更' };
    await repositories.events.saveOccurrenceException({
      identity, replacement: { event: replacement, reminders: [{
        id: 'replacement-reminder', eventId: replacement.id, minutesBefore: 60, sortOrder: 0,
      }] }, overrideFields: ['title', 'temporal'], expectedSeriesUpdatedAt: now, now,
    });
    await connection.close();
    connection = await openNodeSqliteDatabase(join(directory, 'synthetic.db'));
    database = connection.database;
    await migrateDatabase(database, environment);
    repositories = createRepositoryContainer(database);
    expect(await repositories.events.getOccurrenceEditData(identity)).toMatchObject({
      exception: { ...identity, kind: 'replaced', replacementEventId: 'replacement' },
      replacement: { event: replacement, reminders: [{ minutesBefore: 60 }] },
    });
    const schedule = await repositories.events.listSchedule('personal-default', '2027-01-01', '2027-01-03');
    expect(schedule.events.map((value) => value.id)).toEqual([series.id]);
    expect(schedule.replacementEvents.map((value) => value.id)).toEqual(['replacement']);
    const occurrences = expandEventOccurrences({ snapshot: schedule, from: '2027-01-01', through: '2027-01-03' });
    expect(occurrences.ok).toBe(true);
    if (occurrences.ok) {
      expect(occurrences.value.filter((value) => value.event.title === '個別変更'))
        .toMatchObject([{ occurrenceIdentity: identity, occurrenceStartDate: '2027-01-02' }]);
    }
    await repositories.events.delete(series.id);
    expect(await database.all('SELECT * FROM events')).toEqual([]);
    expect(await database.all('SELECT * FROM recurrence_exceptions')).toEqual([]);
    expect(await database.all('SELECT * FROM event_reminders')).toEqual([]);
  });

  it('日内・週・月のざっくりと終日を保存し設定変更後も保存済み期間を維持する', async () => {
    await migrateDatabase(database, environment);
    const repositories = createRepositoryContainer(database);
    const base = {
      id: 'fuzzy', calendarId: event.calendarId, title: '合成期間', anchorDate: '2026-12-31',
      createdTimeZoneId: 'Asia/Tokyo', createdAt: now, updatedAt: now,
      location: null, noteDocument: null, colorId: null, recurrenceRule: null,
    } as const;
    const values: CalendarEvent[] = [
      { ...base, id: 'daily-fuzzy', temporalType: 'fuzzy', temporalDefinitionId: 'personal-default:morning',
        endDate: '2026-12-31', resolutionContext: null },
      { ...base, id: 'weekly-fuzzy', temporalType: 'fuzzy', temporalDefinitionId: 'personal-default:this_week',
        endDate: '2027-01-01', resolutionContext: { version: 1, referenceDate: '2026-12-31',
          periodAnchorDate: '2026-12-28', parameterSnapshot: { thisWeekDeadlineWeekday: 5 } } },
      { ...base, id: 'monthly-fuzzy', temporalType: 'fuzzy', temporalDefinitionId: 'personal-default:month_end',
        anchorDate: '2026-12-27', endDate: '2026-12-31', resolutionContext: {
          version: 1, referenceDate: '2026-12-27', periodAnchorDate: '2026-12-01', parameterSnapshot: {},
        } },
      { ...base, id: 'all-day', temporalType: 'allDay', endDate: '2027-01-02' },
    ];
    for (const value of values) await repositories.events.create({ event: value, reminders: [] });
    await repositories.settings.setThisWeekDeadlineWeekday(7, now);
    await repositories.settings.setHolidayPreferences({ version: 1, calendarId: 'none', adjustThisWeekDeadline: true }, now);
    await connection.close();
    connection = await openNodeSqliteDatabase(join(directory, 'synthetic.db'));
    database = connection.database;
    await migrateDatabase(database, environment);
    const reopened = createRepositoryContainer(database);
    expect(await reopened.settings.getThisWeekDeadlineWeekday()).toBe(7);
    expect(await reopened.settings.getHolidayPreferences()).toEqual({ version: 1, calendarId: 'none', adjustThisWeekDeadline: true });
    for (const value of values) expect(await reopened.events.getById(value.id)).toEqual({ event: value, reminders: [] });
    const january = await reopened.events.listByAnchorRange(event.calendarId, '2027-01-01', '2027-01-01');
    expect(january.map((value) => value.id).sort()).toEqual(['all-day', 'weekly-fuzzy']);
  });
});
