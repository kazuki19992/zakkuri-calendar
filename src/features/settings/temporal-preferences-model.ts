import type {TemporalDefinition} from '@/domain/temporal/temporal-definition';
export const WEEKDAYS=['月曜日','火曜日','水曜日','木曜日','金曜日','土曜日','日曜日'] as const;
export const formatClock=(minute:number)=>`${Math.floor(minute/60)}:${String(minute%60).padStart(2,'0')}`;
export function formatMinutes(value:number):string {
  const h=Math.floor(value/60),m=value%60;return `${h?`${h}時間`:''}${m?`${m}分`:''}`||'0分';
}
export const formatPercent=(value:number)=>`${Math.round(value*10000)/100}%`;
export function formatTemporalRange(definition:TemporalDefinition):string {
  const config=definition.resolverConfig;
  switch(config.kind){
    case 'timeOfDay':return `${formatClock(config.startMinute)}〜${config.endMinute>=1440?'翌日':''}${formatClock(config.endMinute%1440)}`;
    case 'week':return `${WEEKDAYS[config.startWeekday-1]}〜${WEEKDAYS[config.endWeekday-1]}`;
    case 'weekRemainder':return '基準日〜保存時の締切';
    case 'monthDays':return `${config.startDay}日〜${config.endDay==='last'?'月末':`${config.endDay}日`}`;
    case 'monthLastDays':return `月末を含む${config.count}日間`;
  }
}
