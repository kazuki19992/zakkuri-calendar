import {createAgendaItems} from '../calendar-view-model';
import {createMonthWeekViewModels} from '../month-view-model';
import {getMonthGrid} from '@/domain/calendar/month';
import type {CalendarEvent} from '@/domain/calendar/event';
const event:CalendarEvent={id:'warning',calendarId:'personal-default',title:'提出',temporalType:'fuzzy',temporalDefinitionId:'deadline',anchorDate:'2026-11-23',endDate:'2026-11-27',resolutionContext:{version:1,referenceDate:'2026-11-23',periodAnchorDate:'2026-11-23',parameterSnapshot:{thisWeekDeadlineWeekday:5,deadlineAdjustment:{version:1,calendarId:'jp',unadjustedDeadlineDate:'2026-11-27'},deadlineWarning:'noBusinessDay'}},recurrenceRule:null,location:null,noteDocument:null,colorId:null,createdAt:'',updatedAt:'',createdTimeZoneId:'Asia/Tokyo'};
const occurrence={key:'warning',eventId:event.id,event,occurrenceIdentity:null,isRecurring:false,occurrenceStartDate:event.anchorDate,occurrenceThroughDate:event.endDate};
it('締切の要確認を日ビューのタイトルと読み上げに文字で示す',()=>{
  const items=createAgendaItems([occurrence],new Map([['deadline','今週中']]));
  expect(items[0].title).toContain('要確認');expect(items[0].accessibilityLabel).toContain('調整先の平日');
});
it('月の予定ブロックにも要確認を文字で示す',()=>{
  const weeks=createMonthWeekViewModels({grid:getMonthGrid('2026-11-01',1),occurrences:[occurrence],definitionLabels:new Map([['deadline','今週中']]),calendarColorId:'blue'});
  expect(weeks.flatMap(week=>week.segments).some(item=>item.title.includes('要確認'))).toBe(true);
});
