/** @jest-environment node */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openNodeSqliteDatabase, openNodeSqliteDatabaseAsync } from '@/test/node-sqlite-database';
import { openDatabaseAsync } from 'expo-sqlite';
import { migrateDatabase } from '../migrations';
import { createRepositoryContainer } from '../repository-container';
import { temporalDefinitionToken, TemporalConflictError } from '@/domain/temporal/temporal-preferences';
import type { CalendarEvent } from '@/domain/calendar/event';
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
const now = '2026-11-13T00:00:00.000Z';
let dir: string, connection: Awaited<ReturnType<typeof openNodeSqliteDatabase>>, repos: ReturnType<typeof createRepositoryContainer>;
beforeEach(async () => {
  jest.mocked(openDatabaseAsync).mockImplementation(openNodeSqliteDatabaseAsync);
  dir = mkdtempSync(join(tmpdir(), 'temporal-'));
  connection = await openNodeSqliteDatabase(join(dir, 'test.db'));
  await migrateDatabase(connection.database, { now: () => now, timeZoneId: () => 'Asia/Tokyo' });
  repos = createRepositoryContainer(connection.database);
});
afterEach(async () => { await connection.close(); rmSync(dir, {recursive:true, force:true}); });
async function fuzzy(key = 'next_week') {
  const definition = (await repos.temporalDefinitions.listEnabled('personal-default')).find(d => d.key === key)!;
  const event: CalendarEvent = { id:'e', calendarId:'personal-default', title:'検証', temporalType:'fuzzy', temporalDefinitionId: definition.id,
    anchorDate:'2026-11-16', endDate: key === 'next_week' ? '2026-11-22' : '2026-11-16', resolutionContext: definition.granularity === 'day' ? null : {
      version:1, referenceDate:'2026-11-13', periodAnchorDate:'2026-11-16', parameterSnapshot:{}},
    location:null, noteDocument:null, colorId:null, recurrenceRule:null, createdTimeZoneId:'Asia/Tokyo', createdAt:now, updatedAt:now };
  await repos.events.create({event, reminders:[]}); return {event, definition};
}
it('定義と参照予定を更新し通知revisionも同時に進める', async () => {
  const {definition} = await fuzzy();
  const patch = {resolverConfig: {kind:'week', selectionWeekOffset:1, startWeekday:2, endWeekday:4}} as const;
  const preview = await repos.temporalDefinitions.previewUpdate(definition.id, patch);
  expect(preview.count).toBe(1);
  const revision = await repos.notifications.getRevision();
  await repos.temporalDefinitions.updateDefinition({id:definition.id, patch, token:preview.token, now});
  expect((await repos.events.getById('e'))?.event).toMatchObject({ anchorDate:'2026-11-17', endDate:'2026-11-19' });
  expect(await repos.notifications.getRevision()).toBe(revision + 1);
});
it('確認後に予定が変わった場合は保存せず再確認を求める', async () => {
  const {event,definition} = await fuzzy();
  const patch = {fadeInRatio:.1};
  const preview = await repos.temporalDefinitions.previewUpdate(definition.id, patch);
  await repos.events.update({event:{...event,title:'変更'},reminders:[]});
  await expect(repos.temporalDefinitions.updateDefinition({id:definition.id,patch,token:preview.token,now})).rejects.toBeInstanceOf(TemporalConflictError);
  expect((await repos.temporalDefinitions.getById(definition.id))?.fadeInRatio).toBe(0);
});
it('予定更新に失敗すると定義と通知revisionもrollbackする', async () => {
  const {definition} = await fuzzy();
  const patch = {resolverConfig:{kind:'week',selectionWeekOffset:1,startWeekday:3,endWeekday:5}} as const;
  const preview = await repos.temporalDefinitions.previewUpdate(definition.id,patch);
  const revision = await repos.notifications.getRevision();
  await connection.database.exec("CREATE TRIGGER reject_range BEFORE UPDATE OF anchor_date ON events BEGIN SELECT RAISE(ABORT, 'test'); END;");
  await expect(repos.temporalDefinitions.updateDefinition({id:definition.id,patch,token:preview.token,now})).rejects.toThrow();
  expect(await repos.temporalDefinitions.getById(definition.id)).toEqual(definition);
  expect(await repos.notifications.getRevision()).toBe(revision);
});
it('フェードのみの変更は予定日付と通知revisionを維持する', async () => {
  const {definition,event} = await fuzzy(); const patch = {fadeInRatio:.35};
  const preview = await repos.temporalDefinitions.previewUpdate(definition.id,patch);
  const revision = await repos.notifications.getRevision();
  await repos.temporalDefinitions.updateDefinition({id:definition.id,patch,token:preview.token,now});
  expect((await repos.events.getById('e'))?.event).toEqual(event);
  expect(await repos.notifications.getRevision()).toBe(revision);
});
it('未定の表示時間を保存し、不正な保存値を読むだけでは変更しない', async () => {
  await repos.settings.setUndeterminedFadeMinutes(90,now);
  expect(await repos.settings.getUndeterminedFadeMinutes()).toBe(90);
  await expect(repos.settings.setUndeterminedFadeMinutes(1441,now)).rejects.toThrow();
  await connection.database.run("UPDATE app_settings SET value_json='1441' WHERE key='undetermined_fade_minutes'");
  expect(await repos.settings.getUndeterminedFadeMinutes()).toBe(120);
  expect(await connection.database.first("SELECT value_json FROM app_settings WHERE key='undetermined_fade_minutes'")).toEqual({value_json:'1441'});
});
it('古い定義を参照した予定保存をtransaction内で拒否する', async () => {
  const {definition,event} = await fuzzy('morning');
  const patch = {fadeInRatio:.3}; const preview = await repos.temporalDefinitions.previewUpdate(definition.id,patch);
  await repos.temporalDefinitions.updateDefinition({id:definition.id,patch,token:preview.token,now});
  await expect(repos.events.update({event:{...event,title:'上書き'},reminders:[]}, {id:definition.id,token:temporalDefinitionToken(definition)})).rejects.toBeInstanceOf(TemporalConflictError);
  expect((await repos.events.getById('e'))?.event.title).toBe('検証');
});
it('同一snapshotに予定・無効化済みも含む定義・未定時間を含める', async () => {
  const {definition} = await fuzzy('morning');
  await repos.temporalDefinitions.disable(definition.id, now);
  await repos.settings.setUndeterminedFadeMinutes(90, now);
  const snapshot = await repos.events.readTemporalSchedule('personal-default', '2026-11-16', '2026-11-17');
  expect(snapshot.schedule.events).toHaveLength(1);
  expect(snapshot.definitions.find(d => d.id === definition.id)?.isEnabled).toBe(false);
  expect(snapshot.undeterminedFadeMinutes).toBe(90);
});
it('深夜への範囲変更後も繰り返しと個別例外identityを維持し未来通知を再計算する',async()=>{
  const {event,definition}=await fuzzy('morning');
  const series={...event,recurrenceRule:{version:1,frequency:'daily',interval:1,weekdays:[],end:{type:'never'}} as const};
  const reminders=[{id:'r',eventId:'e',timing:{version:1,kind:'relativeMinutes',anchor:'end',minutesBefore:60} as const,sortOrder:0}];
  await repos.events.update({event:series,reminders});
  await repos.events.deleteOccurrenceException({identity:{seriesEventId:'e',originalOccurrenceDate:'2026-11-17'},expectedSeriesUpdatedAt:now,now});
  const before=await repos.notifications.readSnapshot();
  const patch={resolverConfig:{kind:'timeOfDay',startMinute:1320,endMinute:1560}} as const;
  const preview=await repos.temporalDefinitions.previewUpdate(definition.id,patch);
  await repos.temporalDefinitions.updateDefinition({id:definition.id,patch,token:preview.token,now});
  const after=await repos.notifications.readSnapshot();
  expect(after.exceptions).toEqual(before.exceptions);
  expect((await repos.events.getById('e'))?.event).toEqual(series);
  expect(after.definitions.find(d=>d.id===definition.id)?.resolverConfig).toEqual(patch.resolverConfig);
});
