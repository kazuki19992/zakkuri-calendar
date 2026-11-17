import {addMonths,addWeeks,differenceInCalendarMonths,differenceInCalendarWeeks,format,isValid,parse,startOfMonth,startOfWeek} from 'date-fns';
import type {CalendarEvent} from './event';
import {isCalendarDate} from './month';
import type {HolidayProvider} from './holiday';
import type {TemporalDefinition} from '@/domain/temporal/temporal-definition';
import {resolveRelativeDateRange,withoutRelativeSelectionOffset} from '@/domain/temporal/relative-date-resolution';
import {adjustThisWeekDeadline} from '@/domain/temporal/adjust-this-week-deadline';
import type {RelativeRecurrenceRuleV2} from './recurrence';
export type RelativeRecurrenceEnvironment = Readonly<{definitions: readonly TemporalDefinition[]; holidayProvider?: HolidayProvider}>;
const date=(value:string)=>parse(value,'yyyy-MM-dd',new Date(2000,0,1));
const day=(value:Date)=>format(value,'yyyy-MM-dd');
export function relativePeriodStart(value:string,frequency:RelativeRecurrenceRuleV2['frequency']):string {
  if(!isCalendarDate(value))throw new Error('Invalid relative period');
  return day(frequency==='weekly'?startOfWeek(date(value),{weekStartsOn:1}):startOfMonth(date(value)));
}
export function relativeSeries(event:CalendarEvent){
  if(event.temporalType!=='fuzzy'||event.resolutionContext===null||event.recurrenceRule?.version!==2)throw new Error('Invalid relative series');
  return {event,context:event.resolutionContext,rule:event.recurrenceRule};
}
export function relativePeriodAt(event:CalendarEvent,index:number):string|null{
  const {context,rule}=relativeSeries(event);const count=index*rule.interval;
  if(!Number.isSafeInteger(count)||count<0)return null;
  const period=rule.frequency==='weekly'?addWeeks(date(context.periodAnchorDate),count):addMonths(date(context.periodAnchorDate),count);
  if(!isValid(period)||period.getFullYear()>9999||period.getFullYear()<1)return null;
  return day(period);
}
export function relativeOccurrenceIndex(event:CalendarEvent,period:string):number {
  const {context,rule}=relativeSeries(event);
  if(relativePeriodStart(context.periodAnchorDate,rule.frequency)!==context.periodAnchorDate||relativePeriodStart(period,rule.frequency)!==period)throw new Error('Invalid relative identity');
  const distance=rule.frequency==='weekly'?differenceInCalendarWeeks(date(period),date(context.periodAnchorDate),{weekStartsOn:1}):differenceInCalendarMonths(date(period),date(context.periodAnchorDate));
  const index=distance/rule.interval;
  if(!Number.isSafeInteger(index)||index<0||(rule.end.type==='count'&&index>=rule.end.count)||(rule.end.type==='untilPeriod'&&period>rule.end.periodAnchorDate))throw new Error('Relative occurrence outside series');
  return index;
}
export function validateRelativeSeries(event:CalendarEvent,definition:TemporalDefinition):void {
  const {event:fuzzy,rule,context}=relativeSeries(event);
  if(definition.id!==fuzzy.temporalDefinitionId||definition.calendarId!==fuzzy.calendarId||definition.granularity!==(rule.frequency==='weekly'?'week':'month'))throw new Error('Invalid relative definition');
  relativeOccurrenceIndex(event,context.periodAnchorDate);
  if(rule.end.type==='untilPeriod'&&relativePeriodStart(rule.end.periodAnchorDate,rule.frequency)!==rule.end.periodAnchorDate)throw new Error('Invalid final period');
  const p=rule.deadlinePolicy;
  if(definition.resolverConfig.kind==='weekRemainder'){
    const saved=context.parameterSnapshot;
    if(!p||saved.thisWeekDeadlineWeekday!==p.weekday||!!saved.deadlineAdjustment!==p.adjustNonWorkingDays||(p.adjustNonWorkingDays&&saved.deadlineAdjustment?.calendarId!==p.holidayCalendarId))throw new Error('Invalid saved deadline policy');
  }else if(p!==null)throw new Error('Unexpected deadline policy');
}
/** 初回だけ保存snapshotを使い、以降は対象期間内で定義を再適用する。 */
export function resolveRelativeOccurrence(series:CalendarEvent,period:string,environment:RelativeRecurrenceEnvironment):CalendarEvent {
  const {event}=relativeSeries(series);const index=relativeOccurrenceIndex(series,period);
  const definition=environment.definitions.find(d=>d.id===event.temporalDefinitionId);
  if(!definition)throw new Error('Missing relative definition');
  validateRelativeSeries(series,definition);
  if(index===0)return {...event,recurrenceRule:null};
  return resolveAt(event,period,period,definition,environment);
}
export function rebaseRelativeSeries(series:CalendarEvent,referenceDate:string,environment:RelativeRecurrenceEnvironment):CalendarEvent {
  const {event,rule}=relativeSeries(series);const period=relativePeriodStart(referenceDate,rule.frequency);
  const definition=environment.definitions.find(d=>d.id===event.temporalDefinitionId);
  if(!definition)throw new Error('Missing relative definition');
  const result={...resolveAt(event,period,referenceDate,definition,environment),recurrenceRule:rule};
  validateRelativeSeries(result,definition);return result;
}
function resolveAt(event: Extract<CalendarEvent,{temporalType:'fuzzy'}>,period:string,referenceDate:string,definition:TemporalDefinition,environment:RelativeRecurrenceEnvironment):CalendarEvent {
  const rule=event.recurrenceRule;
  if(rule?.version!==2)throw new Error('Invalid relative series');
  const anchored=withoutRelativeSelectionOffset(definition);
  const result=resolveRelativeDateRange(referenceDate,anchored,rule.deadlinePolicy?.weekday??5);
  if(!result.ok)throw new Error('Unable to resolve relative period');
  let resolved=result.value;
  let warning:'noBusinessDay'|'unsupportedHolidayRange'|undefined;
  const policy=rule.deadlinePolicy;
  if(policy?.adjustNonWorkingDays){
    const holidays=policy.holidayCalendarId==='none'?{status:'available' as const,holidays:[]}:environment.holidayProvider?.list(resolved.startDate,resolved.endDate);
    if(!holidays)throw new Error('Missing holiday environment');
    const adjusted=adjustThisWeekDeadline(resolved,{version:1,calendarId:policy.holidayCalendarId,adjustThisWeekDeadline:true},holidays);
    if(adjusted.ok)resolved=adjusted.value;
    else {warning=adjusted.error;resolved={...resolved,parameterSnapshot:{...resolved.parameterSnapshot,deadlineAdjustment:{version:1,calendarId:policy.holidayCalendarId,unadjustedDeadlineDate:resolved.endDate}}};}
  }
  return {...event,anchorDate:resolved.startDate,endDate:resolved.endDate,recurrenceRule:null,resolutionContext:{version:1,referenceDate:resolved.referenceDate,periodAnchorDate:period,parameterSnapshot:{...resolved.parameterSnapshot,...(warning?{deadlineWarning:warning}:{})}}};
}
export function deadlineWarningLabel(event:CalendarEvent):string|null{
  if(event.temporalType!=='fuzzy'||!event.resolutionContext?.parameterSnapshot.deadlineWarning)return null;
  return event.resolutionContext.parameterSnapshot.deadlineWarning==='noBusinessDay'?'締切を要確認（調整先の平日がありません）':'締切を要確認（祝日情報に対応していません）';
}
