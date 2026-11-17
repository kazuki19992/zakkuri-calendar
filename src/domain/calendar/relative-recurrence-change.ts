import {addDays,differenceInCalendarDays,format,parse} from 'date-fns';
import type {CalendarEvent} from './event';
import type {RecurrenceRule} from './recurrence';
import type {EventAggregate} from './event-reminder';
import type {PlanFollowingMutationInput,PlanSeriesMutationInput,RecurrenceMutationPlan} from './recurrence-change';
import {expandEventOccurrences} from './event-occurrence';
import {rebaseRelativeSeries,relativeOccurrenceIndex,resolveRelativeOccurrence,type RelativeRecurrenceEnvironment} from './relative-recurrence';
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export function recurrenceStructureChanged(before:RecurrenceRule|null,after:RecurrenceRule|null):boolean {
  if(before?.version===2&&after?.version===2)return !equal({frequency:before.frequency,interval:before.interval,end:before.end},{frequency:after.frequency,interval:after.interval,end:after.end});
  return !equal(before,after);
}
export function relativeMeaningChanged(before:CalendarEvent,after:CalendarEvent):boolean {
  if(before.recurrenceRule?.version!==2&&after.recurrenceRule?.version!==2)return false;
  return !equal(before.recurrenceRule,after.recurrenceRule)||before.temporalType!==after.temporalType||
    (before.temporalType==='fuzzy'&&after.temporalType==='fuzzy'&&before.temporalDefinitionId!==after.temporalDefinitionId);
}
function baseOccurrence(event:CalendarEvent,identity:string,environment:RelativeRecurrenceEnvironment):CalendarEvent {
  if(event.recurrenceRule?.version===2)return resolveRelativeOccurrence(event,identity,environment);
  const result=expandEventOccurrences({events:[event],from:identity,through:identity});
  if(!result.ok||!result.value[0])throw new Error('Invalid recurrence boundary');
  return {...result.value[0].event,anchorDate:result.value[0].occurrenceStartDate,recurrenceRule:null};
}
function countBefore(event:CalendarEvent,identity:string):number{
  if(event.recurrenceRule?.version===2)return relativeOccurrenceIndex(event,identity);
  const result=expandEventOccurrences({events:[event],from:event.anchorDate,through:identity});
  if(!result.ok)throw new Error('Invalid recurrence boundary');
  const index=result.value.findIndex(o=>o.occurrenceIdentity?.originalOccurrenceDate===identity);
  if(index<0)throw new Error('Invalid recurrence boundary');return index;
}
/** 単位変更は識別日ではなく、変更対象先頭回の表示開始日へ対応付ける。 */
function relocate(candidate:CalendarEvent,reference:string,environment:RelativeRecurrenceEnvironment):CalendarEvent{
  if(candidate.recurrenceRule?.version===2)return rebaseRelativeSeries(candidate,reference,environment);
  if(candidate.temporalType==='fuzzy'&&candidate.resolutionContext){
    const definition=environment.definitions.find(d=>d.id===candidate.temporalDefinitionId);
    if(!definition||definition.granularity==='day')throw new Error('Missing relative definition');
    const p=candidate.resolutionContext.parameterSnapshot;
    const synthetic={...candidate,recurrenceRule:{version:2 as const,kind:'relativePeriod' as const,frequency:definition.granularity==='week'?'weekly' as const:'monthly' as const,interval:1,end:{type:'never' as const},deadlinePolicy:definition.key==='this_week'?{version:1 as const,weekday:p.thisWeekDeadlineWeekday??5,adjustNonWorkingDays:!!p.deadlineAdjustment,holidayCalendarId:p.deadlineAdjustment?.calendarId??'none' as const}:null}};
    return {...rebaseRelativeSeries(synthetic,reference,environment),recurrenceRule:candidate.recurrenceRule};
  }
  const delta=differenceInCalendarDays(parse(reference,'yyyy-MM-dd',new Date()),parse(candidate.anchorDate,'yyyy-MM-dd',new Date()));
  return {...candidate,anchorDate:reference,...(candidate.temporalType!=='exact'?{endDate:format(addDays(parse(candidate.endDate,'yyyy-MM-dd',new Date()),delta),'yyyy-MM-dd')}:{})};
}
export function planRelativeFollowingMutation(input:PlanFollowingMutationInput):RecurrenceMutationPlan{
  const source=input.series.event,original=source.recurrenceRule;
  if(!original)throw new Error('Missing recurrence');
  const ordinal=countBefore(source,input.boundaryDate),changed=relativeMeaningChanged(source,input.submitted.event);
  const affected=input.exceptions.filter(e=>e.seriesEventId===source.id&&e.originalOccurrenceDate>=input.boundaryDate);
  const next=input.submitted.event;
  let rule=next.recurrenceRule;
  if(original.end.type==='count'&&rule?.end.type==='count'&&original.end.count===rule.end.count)rule={...rule,end:{type:'count',count:original.end.count-ordinal}};
  const id=input.createSeriesId();
  const previousRule=original.version===2?{...original,end:{type:'count' as const,count:ordinal}}:{...original,end:{type:'until' as const,date:format(addDays(parse(input.boundaryDate,'yyyy-MM-dd',new Date()),-1),'yyyy-MM-dd')}};
  return {removePreviousSeries:ordinal===0,previousSeries:ordinal===0?null:{event:{...source,recurrenceRule:previousRule,updatedAt:input.now},reminders:input.series.reminders},
    nextSeries:{event:{...next,id,recurrenceRule:rule,createdAt:input.now,updatedAt:input.now},reminders:input.submitted.reminders.map(r=>({...r,eventId:id}))},
    upsertExceptions:changed?[]:affected.map(e=>({...e,seriesEventId:id,updatedAt:input.now})),
    deleteExceptionIdentities:affected.map(e=>({seriesEventId:e.seriesEventId,originalOccurrenceDate:e.originalOccurrenceDate})),deleteReplacementEventIds:changed?affected.flatMap(e=>e.replacementEventId?[e.replacementEventId]:[]):[]};
}
export function planRelativeSeriesMutation(input:PlanSeriesMutationInput):RecurrenceMutationPlan{
  const source=input.series.event,environment=input.environment??{definitions:[]};countBefore(source,input.boundaryDate);
  const changed=relativeMeaningChanged(source,input.submitted.event);
  let next:CalendarEvent;
  if(!changed){
    const candidate=input.submitted.event;
    // 初回の解決範囲だけの変更は未来回の規則を変えないため、既存例外を維持する。
    const initialIdentity=source.temporalType==='fuzzy'?source.resolutionContext?.periodAnchorDate:source.anchorDate;
    next=input.boundaryDate===initialIdentity?candidate:{...source,title:candidate.title,location:candidate.location,noteDocument:candidate.noteDocument,colorId:candidate.colorId};
  }else if(input.boundaryDate===(source.temporalType==='fuzzy'?source.resolutionContext?.periodAnchorDate:source.anchorDate)){
    // 初回を変更する場合、提出された解決済み期間を再度selection offset前へ戻さない。
    next=input.submitted.event;
  }else if(input.submitted.event.recurrenceRule===null&&source.recurrenceRule?.version===2){
    const occurrence=baseOccurrence(source,input.boundaryDate,environment),candidate=input.submitted.event;
    const sameTime=candidate.temporalType==='fuzzy'&&occurrence.temporalType==='fuzzy'&&candidate.temporalDefinitionId===occurrence.temporalDefinitionId&&candidate.anchorDate===occurrence.anchorDate&&candidate.endDate===occurrence.endDate&&equal(candidate.resolutionContext,occurrence.resolutionContext);
    next=sameTime?{...source,title:candidate.title,location:candidate.location,noteDocument:candidate.noteDocument,colorId:candidate.colorId,recurrenceRule:null}:relocate(candidate,source.anchorDate,environment);
  }else next=relocate(input.submitted.event,source.anchorDate,environment);
  const nextSeries:EventAggregate={event:{...next,id:source.id,createdAt:source.createdAt,updatedAt:input.now},reminders:input.submitted.reminders.map(r=>({...r,eventId:source.id}))};
  return {removePreviousSeries:false,previousSeries:null,nextSeries,upsertExceptions:changed?[]:input.exceptions,
    deleteExceptionIdentities:changed?input.exceptions.map(e=>({seriesEventId:e.seriesEventId,originalOccurrenceDate:e.originalOccurrenceDate})):[],
    deleteReplacementEventIds:changed?input.exceptions.flatMap(e=>e.replacementEventId?[e.replacementEventId]:[]):[]};
}
