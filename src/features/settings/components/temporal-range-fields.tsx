import { Spacing, Typography } from '@/constants/theme';
import { SymbolView } from 'expo-symbols';
import {useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {SingleSelectSheet} from '@/shared/components/single-select-sheet';
import {useTheme} from '@/hooks/use-theme';
import type {TemporalDefinition} from '@/domain/temporal/temporal-definition';
import type {TemporalDefinitionPatch} from '@/domain/temporal/temporal-preferences';
import {formatTemporalRange,WEEKDAYS} from '../temporal-preferences-model';
export function TemporalRangeFields({definition,onChange,disabled}:{definition:TemporalDefinition;onChange(patch:TemporalDefinitionPatch):void;disabled:boolean}){
  const theme=useTheme();const [field,setField]=useState<string|null>(null);const c=definition.resolverConfig;
  const row=(key:string,label:string,value:string)=><Pressable key={key} accessibilityRole="button" accessibilityLabel={`${label}、${value}`} disabled={disabled}
    accessibilityState={{disabled}} onPress={()=>setField(key)} style={{minHeight:48,flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:Spacing.twelve,flexWrap:'wrap'}}>
    <Text style={{color:theme.text,fontSize:Typography.row}}>{label}</Text>
    <View style={{flexDirection:'row',alignItems:'center',gap:Spacing.two}}>
      <Text style={{color:theme.textSecondary}}>{value}</Text>
      <SymbolView accessible={false} name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={12} tintColor={theme.textSecondary} />
    </View></Pressable>;
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
  return <View style={{gap:Spacing.two}}>
    {c.kind !== 'timeOfDay' ? <>
      <Text accessibilityRole="header" style={{color:theme.text,fontSize:Typography.row}}>範囲</Text>
      <Text style={{color:theme.textSecondary}}>{formatTemporalRange(definition)}</Text>
    </> : null}
    {c.kind==='timeOfDay'?row('endDay','終了する日',c.endMinute>=1440?'翌日':'当日'):null}
    {c.kind==='week'?<>{row('startWeekday','開始曜日',WEEKDAYS[c.startWeekday-1])}{row('endWeekday','終了曜日',WEEKDAYS[c.endWeekday-1])}</>:null}
    {c.kind==='monthDays'?<>{row('startDay','開始日',`${c.startDay}日`)}{row('endDay','終了日',c.endDay==='last'?'月末':`${c.endDay}日`)}</>:null}
    {c.kind==='monthLastDays'?row('count','月末を含む日数',`${c.count}日間`):null}
    <SingleSelectSheet visible={field!==null} title={title} value={value} options={options} disabled={disabled} onSelect={change} onClose={()=>setField(null)}/>
  </View>;
}
