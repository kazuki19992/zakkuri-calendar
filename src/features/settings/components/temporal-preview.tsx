import {resolveRelativeDateRange} from '@/domain/temporal/relative-date-resolution';
import {createOpacityStops} from '@/features/calendar/timeline-layout';
import {Text,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {useTheme} from '@/hooks/use-theme';
import {createDateRangeOpacityStops} from '@/features/calendar/date-range-gradient';
import type {TemporalDefinition} from '@/domain/temporal/temporal-definition';
import {formatTemporalRange,formatPercent} from '../temporal-preferences-model';
export function TemporalPreview({definition}:{definition:TemporalDefinition}){
  const theme=useTheme();
  const config=definition.resolverConfig;
  // 表示例の基準日は固定し、範囲そのものはdraftから実表示と同じ規則で解決する。
  const range=definition.granularity==='day'?null:resolveRelativeDateRange('2026-11-16',definition,5);
  const stops=config.kind==='timeOfDay'
    ?createOpacityStops({rangeStart:config.startMinute,rangeEnd:config.endMinute,clipStart:config.startMinute,clipEnd:config.endMinute,fadeInRatio:definition.fadeInRatio,fadeOutRatio:definition.fadeOutRatio})
    :range?.ok?createDateRangeOpacityStops({rangeStartDate:range.value.startDate,rangeThroughDate:range.value.endDate,clipStartDate:range.value.startDate,clipThroughDate:range.value.endDate,fadeInRatio:definition.fadeInRatio,fadeOutRatio:definition.fadeOutRatio})
    :[{offset:0,opacity:1},{offset:1,opacity:1}];
  const color=theme.calendarAccent;
  return <View style={{gap:10}}>
    <Text accessibilityRole="header" style={{color:theme.text,fontSize:17}}>プレビュー</Text>
    <View style={{height:definition.granularity==='day'?120:72,borderWidth:1,borderColor:theme.calendarBorder,borderRadius:8,overflow:'hidden'}}>
      <LinearGradient testID="temporal-preview.gradient" style={{flex:1}}
        colors={stops.map(stop=>`${color}${Math.round(stop.opacity*255).toString(16).padStart(2,'0')}`) as [string,string,...string[]]}
        locations={stops.map(stop=>stop.offset) as [number,number,...number[]]}
        start={{x:0,y:0}} end={definition.granularity==='day'?{x:0,y:1}:{x:1,y:0}}/>
    </View>
    <Text style={{color:theme.text}}>{definition.label}　{formatTemporalRange(definition)}</Text>
    {range?.ok&&range.value.startDate===range.value.endDate?<Text style={{color:theme.textSecondary}}>1日だけの期間は、カレンダーと同じくぼかさず表示します。</Text>:null}
    <Text style={{color:theme.textSecondary}}>開始{formatPercent(definition.fadeInRatio)}、終了{formatPercent(definition.fadeOutRatio)}。説明用の表示例です。</Text>
  </View>;
}
