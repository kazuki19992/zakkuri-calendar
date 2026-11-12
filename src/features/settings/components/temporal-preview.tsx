import {Text,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {useTheme} from '@/hooks/use-theme';
import {createDateRangeOpacityStops} from '@/features/calendar/date-range-gradient';
import type {TemporalDefinition} from '@/domain/temporal/temporal-definition';
import {formatTemporalRange,formatPercent} from '../temporal-preferences-model';
export function TemporalPreview({definition}:{definition:TemporalDefinition}){
  const theme=useTheme();
  const stops=createDateRangeOpacityStops({rangeStartDate:'2026-11-16',rangeThroughDate:'2026-11-22',clipStartDate:'2026-11-16',clipThroughDate:'2026-11-22',fadeInRatio:definition.fadeInRatio,fadeOutRatio:definition.fadeOutRatio});
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
    <Text style={{color:theme.textSecondary}}>開始{formatPercent(definition.fadeInRatio)}、終了{formatPercent(definition.fadeOutRatio)}。説明用の表示例です。</Text>
  </View>;
}
