import {buildRelativeRecurrenceRule} from '../relative-recurrence-draft';
import {createStandardTemporalDefinitions} from '@/domain/temporal/standard-definitions';
import {resolveRelativeDateRange} from '@/domain/temporal/relative-date-resolution';
import {getRecurrenceDraft} from '../event-editor-model';
const definition=createStandardTemporalDefinitions('personal-default','2026-11-17').find(d=>d.key==='month_end')!;
const resolved=resolveRelativeDateRange('2026-11-17',definition,5);if(!resolved.ok)throw new Error('fixture');
const context={version:1 as const,referenceDate:'2026-11-17',periodAnchorDate:resolved.value.periodAnchorDate,parameterSnapshot:{}};
it('月の表現ではNか月ごとと最終対象月を正規化する',()=>{
  const draft={...getRecurrenceDraft(null,'2026-11-17'),preset:'custom' as const,frequency:'monthly' as const,intervalText:'2',endType:'until' as const,untilDate:'2027-03-23'};
  expect(buildRelativeRecurrenceRule(draft,definition,context)).toMatchObject({ok:true,value:{version:2,frequency:'monthly',interval:2,end:{type:'untilPeriod',periodAnchorDate:'2027-03-01'}}});
});
it('単位の不一致や終了期間の未指定を保存しない',()=>{
  const draft={...getRecurrenceDraft(null,'2026-11-17'),preset:'custom' as const,frequency:'weekly' as const};
  expect(buildRelativeRecurrenceRule(draft,definition,context).ok).toBe(false);
  expect(buildRelativeRecurrenceRule({...draft,frequency:'monthly',endType:'until',untilDate:''},definition,context).ok).toBe(false);
});
it('fallbackでも保存済みの休日調整条件を引き継ぐ',()=>{
  const week=createStandardTemporalDefinitions('personal-default','2026-11-17').find(d=>d.key==='this_week')!;
  const draft={...getRecurrenceDraft(null,'2026-11-17'),preset:'weekly' as const};
  expect(buildRelativeRecurrenceRule(draft,week,{...context,periodAnchorDate:'2026-11-16',parameterSnapshot:{thisWeekDeadlineWeekday:5,deadlineAdjustment:{version:1,calendarId:'jp',unadjustedDeadlineDate:'2026-11-20'},deadlineWarning:'noBusinessDay'}})).toMatchObject({ok:true,value:{deadlinePolicy:{weekday:5,adjustNonWorkingDays:true,holidayCalendarId:'jp'}}});
});
it('毎月を選び直しても入力済み回数を終了なしへ読み替えない',()=>{
  const draft={...getRecurrenceDraft(null,'2026-11-17'),preset:'monthly' as const,frequency:'monthly' as const,endType:'count' as const,countText:'4'};
  expect(buildRelativeRecurrenceRule(draft,definition,context)).toMatchObject({ok:true,value:{end:{type:'count',count:4}}});
});
