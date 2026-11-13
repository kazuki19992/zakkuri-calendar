import { applyTemporalPatch, reResolveTemporalEvent, parseUndeterminedMinutes } from '../temporal-preferences';
import { createStandardTemporalDefinitions } from '../standard-definitions';
import type { CalendarEvent } from '@/domain/calendar/event';
const definitions = createStandardTemporalDefinitions('personal-default', '2026-11-13T00:00:00Z');
const def = (key: string) => definitions.find(d => d.key === key)!;
function event(key: string, period = '2026-11-16'): CalendarEvent {
  return { id: 'e', calendarId: 'personal-default', title: '予定', temporalType: 'fuzzy', temporalDefinitionId: def(key).id,
    anchorDate: period, endDate: period, resolutionContext: { version: 1, referenceDate: '2026-11-13', periodAnchorDate: period, parameterSnapshot: {} },
    recurrenceRule: null, colorId: null, location: null, noteDocument: null, createdAt: '', updatedAt: '', createdTimeZoneId: 'Asia/Tokyo' };
}
it('日跨ぎと24時間を許可し、それを超える範囲を拒否する', () => {
  expect(applyTemporalPatch(def('night'), { resolverConfig: {kind: 'timeOfDay', startMinute: 1320, endMinute: 1560} }).resolverConfig).toMatchObject({ endMinute: 1560 });
  expect(() => applyTemporalPatch(def('night'), { resolverConfig: {kind: 'timeOfDay', startMinute: 0, endMinute: 1441} })).toThrow();
  expect(applyTemporalPatch(def('night'), { resolverConfig: {kind: 'timeOfDay', startMinute: 0, endMinute: 1440} })).toBeDefined();
});
it('種類と選択オフセットの変更を拒否する', () => {
  expect(() => applyTemporalPatch(def('next_week'), { resolverConfig: {kind: 'week', selectionWeekOffset: 0, startWeekday: 1, endWeekday: 5} })).toThrow();
  expect(() => applyTemporalPatch(def('night'), { resolverConfig: def('am').resolverConfig, fadeInRatio: .8, fadeOutRatio: .5 })).toThrow();
});
it('来週を保存済みの週から再解決し、翌週へ再移動しない', () => {
  const old = event('next_week');
  const next = applyTemporalPatch(def('next_week'), { resolverConfig: {kind: 'week', selectionWeekOffset: 1, startWeekday: 2, endWeekday: 4} });
  expect(reResolveTemporalEvent(old, next)).toMatchObject({ anchorDate: '2026-11-17', endDate: '2026-11-19', resolutionContext: old.temporalType === 'fuzzy' ? old.resolutionContext : null });
});
it.each([['2027-02-01', '2027-02-28'], ['2028-02-01', '2028-02-29']])('来月の%sで月末へ丸める', (period, expected) => {
  const next = applyTemporalPatch(def('next_month'), {resolverConfig: {kind:'monthDays', selectionMonthOffset:1, startDay:29, endDay:'last'}});
  expect(reResolveTemporalEvent(event('next_month', period), next)).toMatchObject({ anchorDate: expected, endDate: expected });
});
it('今週中の締切調整結果と非刻みのフェードを維持する', () => {
  const old = { ...event('this_week', '2026-11-09'), anchorDate: '2026-11-11', endDate: '2026-11-12' };
  expect(reResolveTemporalEvent(old, applyTemporalPatch(def('this_week'), {fadeInRatio:.333}))).toEqual(old);
  expect(applyTemporalPatch(def('morning'), {fadeInRatio:.333}).fadeInRatio).toBe(.333);
});
it.each([0, -1, 1441, 1.5, null])('未定時間%sを拒否する', value => expect(parseUndeterminedMinutes(value)).toBeNull());
it.each([1,120,1440])('未定時間%dを許可する', value => expect(parseUndeterminedMinutes(value)).toBe(value));
it('対象週・月の起点が不整合な保存済み予定は再解決しない',()=>{
  expect(()=>reResolveTemporalEvent(event('next_week','2026-11-17'),def('next_week'))).toThrow();
  expect(()=>reResolveTemporalEvent(event('next_month','2026-12-15'),def('next_month'))).toThrow();
});
