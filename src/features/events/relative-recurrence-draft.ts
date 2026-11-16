import {parseRecurrenceRule,type RelativeRecurrenceRuleV2} from '@/domain/calendar/recurrence';
import type {FuzzyResolutionContextV1,EventValidationError} from '@/domain/calendar/event';
import type {TemporalDefinition} from '@/domain/temporal/temporal-definition';
import {relativePeriodStart} from '@/domain/calendar/relative-recurrence';
import type {Result} from '@/domain/shared/result';
import type {RecurrenceDraft} from './event-editor-model';
export function buildRelativeRecurrenceRule(draft:RecurrenceDraft,definition:TemporalDefinition,context:FuzzyResolutionContextV1):Result<RelativeRecurrenceRuleV2|null,EventValidationError>{
  const fail=(message:string):Result<never,EventValidationError>=>({ok:false,error:{field:'recurrenceRule',message}});
  if(draft.preset==='none')return {ok:true,value:null};
  const frequency=definition.granularity==='week'?'weekly':definition.granularity==='month'?'monthly':null;
  if(!frequency||(draft.preset!=='custom'&&draft.preset!==frequency)||(draft.preset==='custom'&&draft.frequency!==frequency))return fail('時間表現に対応する週または月の繰り返しを選択してください');
  const integer=(text:string)=>/^\d+$/.test(text)&&Number.isSafeInteger(Number(text))&&Number(text)>0;
  if(draft.preset==='custom'&&!integer(draft.intervalText))return fail('繰り返し間隔は1以上の整数で入力してください');
  let end:RelativeRecurrenceRuleV2['end']={type:'never'};
  if(draft.endType==='count'){
    if(!integer(draft.countText))return fail('繰り返し回数は1以上の整数で入力してください');end={type:'count',count:Number(draft.countText)};
  }
  if(draft.endType==='until'){
    try{const periodAnchorDate=relativePeriodStart(draft.untilDate,frequency);if(periodAnchorDate<context.periodAnchorDate)return fail('終了対象は初回の週または月以降にしてください');end={type:'untilPeriod',periodAnchorDate};}
    catch{return fail('終了する対象週または月を選び直してください');}
  }
  const p=context.parameterSnapshot;
  const deadlinePolicy=definition.resolverConfig.kind==='weekRemainder'?{version:1 as const,weekday:p.thisWeekDeadlineWeekday??5,adjustNonWorkingDays:!!p.deadlineAdjustment,holidayCalendarId:p.deadlineAdjustment?.calendarId??'none'}:null;
  const result=parseRecurrenceRule({version:2,kind:'relativePeriod',frequency,interval:draft.preset==='custom'?Number(draft.intervalText):1,end,deadlinePolicy});
  return result.ok&&result.value.version===2?{ok:true,value:result.value}:fail('繰り返し条件を確認してください');
}

export function relativeEndDescription(rule:import('@/domain/calendar/recurrence').RecurrenceRule|null):string{
  if(!rule)return '繰り返しなし';
  if(rule.end.type==='never')return '終了なし';
  if(rule.end.type==='count')return `${rule.end.count}回`;
  if(rule.end.type==='untilPeriod'){const [year,month,day]=rule.end.periodAnchorDate.split('-').map(Number);return rule.frequency==='weekly'?`${year}年${month}月${day}日の週まで`:`${year}年${month}月まで`;}
  return `${rule.end.date}まで`;
}
