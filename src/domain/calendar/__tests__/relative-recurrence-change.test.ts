import {createStandardTemporalDefinitions} from '@/domain/temporal/standard-definitions';
import {resolveRelativeDateRange} from '@/domain/temporal/relative-date-resolution';
import type {CalendarEvent} from '../event';
import {buildSeriesScopedAggregate,planFollowingMutation,planSeriesMutation} from '../recurrence-change';
import {resolveRelativeOccurrence} from '../relative-recurrence';
const definitions=createStandardTemporalDefinitions('personal-default','2026-11-17');
const environment={definitions,holidayProvider:{list:()=>({status:'available' as const,holidays:[]})}};
const context=resolveRelativeDateRange('2027-01-18',definitions.find(d=>d.key==='month_end')!,5);
if(!context.ok)throw new Error('fixture');
const event:CalendarEvent={id:'s',calendarId:'personal-default',title:'元',temporalType:'fuzzy',temporalDefinitionId:'personal-default:month_end',anchorDate:context.value.startDate,endDate:context.value.endDate,resolutionContext:{version:1,referenceDate:'2027-01-18',periodAnchorDate:'2027-01-01',parameterSnapshot:{}},recurrenceRule:{version:2,kind:'relativePeriod',frequency:'monthly',interval:1,end:{type:'count',count:5},deadlinePolicy:null},colorId:null,location:null,noteDocument:null,createdAt:'old',updatedAt:'old',createdTimeZoneId:'Asia/Tokyo'};
const series={event,reminders:[]};
const exception={seriesEventId:'s',originalOccurrenceDate:'2027-03-01',kind:'deleted' as const,replacementEventId:null,overrideFields:[],createdAt:'old',updatedAt:'old'};
function submitted(){return {event:{...resolveRelativeOccurrence(event,'2027-02-01',environment),title:'変更',recurrenceRule:event.recurrenceRule},reminders:[]};}
it('月初identityからの内容変更でも月末の実期間を維持する',()=>{
  const displayed=submitted();const result=buildSeriesScopedAggregate({series,occurrenceDate:'2027-02-01',displayed,submitted:{...displayed,event:{...displayed.event,title:'新しい本文'}},environment});
  expect(result.event).toMatchObject({anchorDate:'2027-02-24',endDate:'2027-02-28',title:'新しい本文'});
});
it('これ以降の内容変更は残回数と期間identityを引き継ぐ',()=>{
  const plan=planFollowingMutation({series,boundaryDate:'2027-02-01',submitted:submitted(),exceptions:[exception],createSeriesId:()=> 'next',now:'new',environment});
  expect(plan.previousSeries?.event.recurrenceRule?.end).toEqual({type:'count',count:1});
  expect(plan.nextSeries?.event).toMatchObject({anchorDate:'2027-02-24',endDate:'2027-02-28',recurrenceRule:{end:{type:'count',count:4}}});
  expect(plan.upsertExceptions[0]).toMatchObject({seriesEventId:'next',originalOccurrenceDate:'2027-03-01'});
});
it('全体の内容変更は元の初回を移動させない',()=>{
  const plan=planSeriesMutation({series,boundaryDate:'2027-02-01',submitted:submitted(),exceptions:[exception],now:'new',environment});
  expect(plan.nextSeries?.event).toMatchObject({anchorDate:'2027-01-27',endDate:'2027-01-31',title:'変更'});
  expect(plan.upsertExceptions).toEqual([exception]);
});
it('間隔を変えた範囲だけ例外をリセットする',()=>{
  const next=submitted();if(next.event.recurrenceRule?.version!==2)return;
  const plan=planFollowingMutation({series,boundaryDate:'2027-02-01',submitted:{...next,event:{...next.event,recurrenceRule:{...next.event.recurrenceRule,interval:2}}},exceptions:[exception],createSeriesId:()=> 'next',now:'new',environment});
  expect(plan.upsertExceptions).toEqual([]);expect(plan.deleteExceptionIdentities).toEqual([{seriesEventId:'s',originalOccurrenceDate:'2027-03-01'}]);
});
it('繰り返しを外す全体変更では初回の期間を単発として残す',()=>{
  const next=submitted();const plan=planSeriesMutation({series,boundaryDate:'2027-02-01',submitted:{...next,event:{...next.event,recurrenceRule:null}},exceptions:[exception],now:'new',environment});
  expect(plan.nextSeries?.event).toMatchObject({anchorDate:'2027-01-27',endDate:'2027-01-31',recurrenceRule:null});
});
it.each([
  ['next_week','interval'],['next_week','stop'],['next_month','interval'],['next_month','stop'],
])('%sの初回を%s変更しても選択offset適用前へ戻さない',(key,change)=>{
  const definition=definitions.find(d=>d.key===key)!;const result=resolveRelativeDateRange('2026-11-18',definition,5);if(!result.ok)throw new Error('fixture');
  const current:CalendarEvent={...event,temporalType:'fuzzy',temporalDefinitionId:definition.id,anchorDate:result.value.startDate,endDate:result.value.endDate,resolutionContext:{version:1,referenceDate:result.value.referenceDate,periodAnchorDate:result.value.periodAnchorDate,parameterSnapshot:{}},recurrenceRule:{version:2,kind:'relativePeriod',frequency:definition.granularity==='week'?'weekly':'monthly',interval:1,end:{type:'count',count:5},deadlinePolicy:null}};
  if(current.recurrenceRule?.version!==2)throw new Error('fixture');
  const plan=planFollowingMutation({series:{event:current,reminders:[]},boundaryDate:result.value.periodAnchorDate,submitted:{event:{...current,recurrenceRule:change==='stop'?null:{...current.recurrenceRule,interval:2}},reminders:[]},exceptions:[],createSeriesId:()=> 'split',now:'new',environment});
  expect(plan.nextSeries?.event).toMatchObject({anchorDate:result.value.startDate,endDate:result.value.endDate,resolutionContext:current.temporalType==='fuzzy'?current.resolutionContext:null});
});
it('保存済みの祝日調整結果を全体の単発化で再計算しない',()=>{
  const definition=definitions.find(d=>d.key==='this_week')!;
  const current:CalendarEvent={...event,temporalType:'fuzzy',temporalDefinitionId:definition.id,anchorDate:'2026-11-18',endDate:'2026-11-19',resolutionContext:{version:1,referenceDate:'2026-11-18',periodAnchorDate:'2026-11-16',parameterSnapshot:{thisWeekDeadlineWeekday:5,deadlineAdjustment:{version:1,calendarId:'jp',unadjustedDeadlineDate:'2026-11-20'}}},recurrenceRule:{version:2,kind:'relativePeriod',frequency:'weekly',interval:1,end:{type:'never'},deadlinePolicy:{version:1,weekday:5,adjustNonWorkingDays:true,holidayCalendarId:'jp'}}};
  const plan=planSeriesMutation({series:{event:current,reminders:[]},boundaryDate:'2026-11-16',submitted:{event:{...current,recurrenceRule:null},reminders:[]},exceptions:[],now:'new',environment});
  expect(plan.nextSeries?.event).toMatchObject({anchorDate:'2026-11-18',endDate:'2026-11-19',resolutionContext:current.temporalType==='fuzzy'?current.resolutionContext:null,recurrenceRule:null});
});

it('初回の期間だけを全体変更すると保存し、後の例外は維持する', () => {
  const definition = definitions.find(d => d.key === 'this_week')!;
  const current: CalendarEvent = {...event, temporalType:'fuzzy', temporalDefinitionId:definition.id,
    anchorDate:'2027-01-18', endDate:'2027-01-22', resolutionContext:{version:1, referenceDate:'2027-01-18', periodAnchorDate:'2027-01-18', parameterSnapshot:{thisWeekDeadlineWeekday:5}},
    recurrenceRule:{version:2,kind:'relativePeriod',frequency:'weekly',interval:1,end:{type:'never'},deadlinePolicy:{version:1,weekday:5,adjustNonWorkingDays:false,holidayCalendarId:'none'}}};
  const changed = {...current, anchorDate:'2027-01-20', resolutionContext:{...current.resolutionContext!, referenceDate:'2027-01-20'}};
  const future = {...exception, originalOccurrenceDate:'2027-01-25'};
  const plan = planSeriesMutation({series:{event:current,reminders:[]},boundaryDate:'2027-01-18', submitted:{event:changed,reminders:[]},exceptions:[future],now:'new',environment});
  expect(plan.nextSeries?.event).toMatchObject({anchorDate:'2027-01-20',endDate:'2027-01-22',resolutionContext:changed.resolutionContext});
  expect(plan.upsertExceptions).toEqual([future]);
  expect(plan.deleteExceptionIdentities).toEqual([]);
  expect(plan.deleteReplacementEventIds).toEqual([]);
});
