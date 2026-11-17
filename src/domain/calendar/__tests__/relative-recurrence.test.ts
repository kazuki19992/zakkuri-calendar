import {createStandardTemporalDefinitions} from '@/domain/temporal/standard-definitions';
import {resolveRelativeDateRange} from '@/domain/temporal/relative-date-resolution';
import {expandEventOccurrences} from '../event-occurrence';
import {resolveRelativeOccurrence,relativeOccurrenceIndex} from '../relative-recurrence';
import {parseRecurrenceRule} from '../recurrence';
import {parseCalendarEvent,type CalendarEvent} from '../event';
const definitions=createStandardTemporalDefinitions('personal-default','2026-11-17T00:00:00Z');
const environment={definitions,holidayProvider:{list:jest.fn().mockReturnValue({status:'available',holidays:[]})}};
function series(key='month_end',reference='2026-11-18'):CalendarEvent{
  const definition=definitions.find(d=>d.key===key)!;const result=resolveRelativeDateRange(reference,definition,5);
  if(!result.ok)throw new Error('fixture');
  return {id:'series',calendarId:'personal-default',title:'検証',temporalType:'fuzzy',temporalDefinitionId:definition.id,
    anchorDate:result.value.startDate,endDate:result.value.endDate,resolutionContext:{version:1,referenceDate:reference,periodAnchorDate:result.value.periodAnchorDate,parameterSnapshot:result.value.parameterSnapshot},
    recurrenceRule:{version:2,kind:'relativePeriod',frequency:definition.granularity==='week'?'weekly':'monthly',interval:1,end:{type:'count',count:3},deadlinePolicy:key==='this_week'?{version:1,weekday:5,adjustNonWorkingDays:false,holidayCalendarId:'none'}:null},
    location:null,noteDocument:null,colorId:null,createdTimeZoneId:'Asia/Tokyo',createdAt:'2026-11-17T00:00:00Z',updatedAt:'2026-11-17T00:00:00Z'};
}
it('月末5日間を各月から計算し、identityは月初に固定する',()=>{
  const result=expandEventOccurrences({events:[series('month_end','2027-01-18')],from:'2027-01-01',through:'2027-03-31',environment});
  expect(result.ok&&result.value.map(o=>[o.occurrenceIdentity?.originalOccurrenceDate,o.occurrenceStartDate,o.occurrenceThroughDate])).toEqual([
    ['2027-01-01','2027-01-27','2027-01-31'],['2027-02-01','2027-02-24','2027-02-28'],['2027-03-01','2027-03-27','2027-03-31'],
  ]);
});
it('今週中は初回だけ水曜日からで、次週は月曜日から解決する',()=>{
  const event=series('this_week');
  expect(resolveRelativeOccurrence(event,'2026-11-16',environment)).toMatchObject({anchorDate:'2026-11-18',endDate:'2026-11-20'});
  expect(resolveRelativeOccurrence(event,'2026-11-23',environment)).toMatchObject({anchorDate:'2026-11-23',endDate:'2026-11-27'});
});
it('全平日が休日の週も元の締切と警告を残す',()=>{
  const event=series('this_week');if(event.temporalType!=='fuzzy'||event.recurrenceRule?.version!==2)return;
  const adjusted={...event,recurrenceRule:{...event.recurrenceRule,deadlinePolicy:{version:1 as const,weekday:5 as const,adjustNonWorkingDays:true,holidayCalendarId:'jp' as const}},resolutionContext:{...event.resolutionContext!,parameterSnapshot:{...event.resolutionContext!.parameterSnapshot,deadlineAdjustment:{version:1 as const,calendarId:'jp' as const,unadjustedDeadlineDate:event.endDate}}}};
  const holidays={list:()=>({status:'available' as const,holidays:[23,24,25,26,27].map(d=>({date:`2026-11-${d}`,name:'検証祝日'}))})};
  expect(resolveRelativeOccurrence(adjusted,'2026-11-23',{definitions,holidayProvider:holidays})).toMatchObject({anchorDate:'2026-11-23',endDate:'2026-11-27',resolutionContext:{parameterSnapshot:{deadlineWarning:'noBusinessDay',deadlineAdjustment:{calendarId:'jp',unadjustedDeadlineDate:'2026-11-27'}}}});
});
it('月末と閏年はその回の範囲へ丸める',()=>{
  const event=series('month_end','2028-01-01');
  expect(resolveRelativeOccurrence(event,'2028-02-01',environment)).toMatchObject({anchorDate:'2028-02-25',endDate:'2028-02-29'});
});
it('次月offsetを各回で重ねず、削除した回を回数へ補充しない',()=>{
  const event=series('next_month','2026-11-18');
  const result=expandEventOccurrences({snapshot:{events:[event],replacementEvents:[],exceptions:[{seriesEventId:event.id,originalOccurrenceDate:'2027-01-01',kind:'deleted',replacementEventId:null,overrideFields:[],createdAt:'',updatedAt:''}]},from:'2026-11-01',through:'2027-05-31',environment});
  expect(result.ok&&result.value.map(o=>o.occurrenceIdentity?.originalOccurrenceDate)).toEqual(['2026-12-01','2027-02-01']);
});
it('表示開始日をidentityとして受け付けず、間隔と終了期間を検証する',()=>{
  const event=series();expect(()=>relativeOccurrenceIndex(event,'2026-11-26')).toThrow();
  if(!event.recurrenceRule||event.recurrenceRule.version!==2)return;
  const updated={...event,recurrenceRule:{...event.recurrenceRule,interval:2,end:{type:'untilPeriod' as const,periodAnchorDate:'2027-03-01'}}};
  expect(()=>relativeOccurrenceIndex(updated,'2026-12-01')).toThrow();
  expect(relativeOccurrenceIndex(updated,'2027-03-01')).toBe(2);
  expect(()=>relativeOccurrenceIndex(updated,'2027-05-01')).toThrow();
});
it('未知versionと種類不一致を拒否しV1を保持する',()=>{
  expect(parseRecurrenceRule({version:3}).ok).toBe(false);
  const event=series();expect(parseCalendarEvent(event).ok).toBe(true);
  expect(parseCalendarEvent({...event,recurrenceRule:{version:1,frequency:'monthly',interval:1,weekdays:[],end:{type:'never'}}}).ok).toBe(false);
});
it('metadataだけの個別変更は月初へ移さず、その回の月末範囲を使う',()=>{
  const event=series('month_end','2027-01-18');
  const result=expandEventOccurrences({snapshot:{events:[event],replacementEvents:[{...event,id:'replacement',recurrenceRule:null,title:'個別タイトル'}],exceptions:[{seriesEventId:'series',originalOccurrenceDate:'2027-02-01',kind:'replaced',replacementEventId:'replacement',overrideFields:['title'],createdAt:'',updatedAt:''}]},from:'2027-02-01',through:'2027-02-28',environment});
  expect(result.ok&&result.value[0]).toMatchObject({occurrenceStartDate:'2027-02-24',occurrenceThroughDate:'2027-02-28',event:{title:'個別タイトル'}});
});
it('非常に大きい間隔でも初回を返し、安全に展開を終える',()=>{
  const event=series();if(event.recurrenceRule?.version!==2)return;
  const result=expandEventOccurrences({events:[{...event,recurrenceRule:{...event.recurrenceRule,interval:Number.MAX_SAFE_INTEGER}}],from:'2026-11-01',through:'2027-12-31',environment});
  expect(result.ok&&result.value).toHaveLength(1);
});
it.each(definitions.filter(d=>d.granularity!=='day'))('$label の各対象期間を一度ずつ解決する',definition=>{
  const event=series(definition.key);const before=JSON.stringify(event);
  const result=expandEventOccurrences({events:[event],from:'2026-11-01',through:'2027-03-31',environment});
  expect(result.ok).toBe(true);if(!result.ok)return;
  expect(result.value).toHaveLength(3);expect(new Set(result.value.map(o=>o.occurrenceIdentity?.originalOccurrenceDate)).size).toBe(3);
  expect(JSON.stringify(event)).toBe(before);
});
it('遠い移動例外があっても表示期間の回とその例外だけを解決する',()=>{
  const original=series('month_end','2027-01-18');if(original.temporalType!=='fuzzy'||original.recurrenceRule?.version!==2)throw new Error('fixture');
  const event={...original,recurrenceRule:{...original.recurrenceRule,end:{type:'never' as const}}};
  const lookup=jest.spyOn(definitions,'find');
  const result=expandEventOccurrences({snapshot:{events:[event],replacementEvents:[{...original,id:'moved',anchorDate:'2027-02-10',endDate:'2027-02-11',recurrenceRule:null}],exceptions:[{seriesEventId:event.id,originalOccurrenceDate:'2030-01-01',kind:'replaced',replacementEventId:'moved',overrideFields:['temporal'],createdAt:'',updatedAt:''}]},from:'2027-02-01',through:'2027-02-28',environment});
  expect(result.ok&&result.value).toHaveLength(2);
  expect(lookup.mock.calls.length).toBeLessThanOrEqual(2);lookup.mockRestore();
});

it.each([
  ['2026-10-01', false], ['2026-11-01', true], ['2026-12-01', true],
])('V2の終了対象%sを初回対象と比較する', (periodAnchorDate, accepted) => {
  const event = series('month_end', '2026-11-18');
  if (event.recurrenceRule?.version !== 2) throw new Error('fixture');
  expect(parseCalendarEvent({...event, recurrenceRule: {...event.recurrenceRule,
    end: {type: 'untilPeriod', periodAnchorDate}}}).ok).toBe(accepted);
});
