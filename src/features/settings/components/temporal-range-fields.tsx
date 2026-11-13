import {useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {SingleSelectSheet} from '@/shared/components/single-select-sheet';
import {DurationWheelPicker} from '@/shared/components/duration-wheel-picker';
import {useTheme} from '@/hooks/use-theme';
import type {TemporalDefinition} from '@/domain/temporal/temporal-definition';
import type {TemporalDefinitionPatch} from '@/domain/temporal/temporal-preferences';
import {formatClock,formatTemporalRange,WEEKDAYS} from '../temporal-preferences-model';
export function TemporalRangeFields({definition,onChange,disabled}:{definition:TemporalDefinition;onChange(patch:TemporalDefinitionPatch):void;disabled:boolean}){
  const theme=useTheme();const [field,setField]=useState<string|null>(null);const c=definition.resolverConfig;
  const row=(key:string,label:string,value:string)=><Pressable key={key} accessibilityRole="button" accessibilityLabel={`${label}、${value}`} disabled={disabled}
    accessibilityState={{disabled}} onPress={()=>setField(key)} style={{minHeight:48,flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
    <Text style={{color:theme.text,fontSize:16}}>{label}</Text><Text style={{color:theme.textSecondary}}>{value} ▾</Text></Pressable>;
  const change=(value:number|string)=>{
    if(c.kind==='week'&&(field==='startWeekday'||field==='endWeekday'))onChange({resolverConfig:{...c,[field]:value}});
    else if(c.kind==='monthDays'&&(field==='startDay'||field==='endDay'))onChange({resolverConfig:{...c,[field]:value}});
    else if(c.kind==='monthLastDays')onChange({resolverConfig:{...c,count:Number(value)}});
    else if(c.kind==='timeOfDay'&&field==='endDay')onChange({resolverConfig:{...c,endMinute:c.endMinute%1440+Number(value)*1440}});
    setField(null);
  };
  let value:string|number=0;let options:readonly {value:string|number;label:string}[]=[];let title='範囲';
  if(c.kind==='week'){value=field==='endWeekday'?c.endWeekday:c.startWeekday;options=WEEKDAYS.map((label,index)=>({label,value:index+1}));title=field==='endWeekday'?'終了曜日':'開始曜日';}
  if(c.kind==='monthDays'){value=field==='endDay'?c.endDay:c.startDay;options=Array.from({length:31},(_,i)=>({label:`${i+1}日`,value:i+1}));if(field==='endDay')options=[...options,{label:'月末',value:'last'}];title=field==='endDay'?'終了日':'開始日';}
  if(c.kind==='monthLastDays'){value=c.count;options=Array.from({length:31},(_,i)=>({label:`${i+1}日間`,value:i+1}));title='月末を含む日数';}
  if(c.kind==='timeOfDay'){value=Math.floor(c.endMinute/1440);options=[{label:'当日',value:0},{label:'翌日',value:1}];title='終了する日';}
  const wheel=c.kind==='timeOfDay'&&(field==='startMinute'||field==='endMinute');
  return <View style={{gap:8}}>
    <Text accessibilityRole="header" style={{color:theme.text,fontSize:17}}>範囲</Text>
    <Text style={{color:theme.textSecondary}}>{formatTemporalRange(definition)}</Text>
    {c.kind==='timeOfDay'?<>{row('startMinute','開始時刻',formatClock(c.startMinute))}{row('endDay','終了する日',c.endMinute>=1440?'翌日':'当日')}{row('endMinute','終了時刻',formatClock(c.endMinute%1440))}</>:null}
    {c.kind==='week'?<>{row('startWeekday','開始曜日',WEEKDAYS[c.startWeekday-1])}{row('endWeekday','終了曜日',WEEKDAYS[c.endWeekday-1])}</>:null}
    {c.kind==='monthDays'?<>{row('startDay','開始日',`${c.startDay}日`)}{row('endDay','終了日',c.endDay==='last'?'月末':`${c.endDay}日`)}</>:null}
    {c.kind==='monthLastDays'?row('count','月末を含む日数',`${c.count}日間`):null}
    {c.kind==='weekRemainder'?<Text style={{color:theme.textSecondary}}>締切曜日は「設定」の「今週中の締切」で変更できます。保存済みの締切は変わりません。</Text>:null}
    <SingleSelectSheet visible={field!==null&&!wheel} title={title} value={value} options={options} disabled={disabled} onSelect={change} onClose={()=>setField(null)}/>
    {c.kind==='timeOfDay'?<DurationWheelPicker visible={wheel} initialMinutes={field==='startMinute'?c.startMinute:c.endMinute%1440} maxHours={23}
      title={field==='startMinute'?'開始時刻':'終了時刻'} formatValue={formatClock} onConfirm={minute=>onChange({resolverConfig:{...c,[field==='startMinute'?'startMinute':'endMinute']:field==='startMinute'?minute:minute+Math.floor(c.endMinute/1440)*1440}})} onClose={()=>setField(null)}/>:null}
  </View>;
}
