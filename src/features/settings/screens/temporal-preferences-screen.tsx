import {useState} from 'react';
import {Alert,Pressable,ScrollView,Text,View} from 'react-native';
import {useTheme} from '@/hooks/use-theme';
import {DurationWheelPicker} from '@/shared/components/duration-wheel-picker';
import type {useTemporalPreferences} from '../hooks/use-temporal-preferences';
import {formatMinutes,formatTemporalRange} from '../temporal-preferences-model';
export function TemporalPreferencesScreen({state,pendingMinutes,onChangeMinutes,onOpen}:{state:ReturnType<typeof useTemporalPreferences>;pendingMinutes:number|null;onChangeMinutes(value:number|null):void;onOpen(id:string):void}){
  const theme=useTheme();const [selecting,setSelecting]=useState(false);
  const button=(label:string,action:()=>void,disabled=false)=><Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={action} style={{minHeight:48,justifyContent:'center'}}><Text style={{color:theme.calendarAccent,fontSize:16}}>{label}</Text></Pressable>;
  return <ScrollView style={{backgroundColor:theme.background}} contentContainerStyle={{padding:20,gap:16,paddingBottom:48}}>
    {state.error?<Text accessibilityRole="alert" style={{color:theme.calendarHoliday}}>{state.error}</Text>:null}
    {state.status==='loading'?<Text style={{color:theme.text}}>読み込み中…</Text>:null}
    {state.status==='error'?button('再読み込み',()=>{void state.reload();}):null}
    {state.status==='ready'?<>
      {(['day','week','month'] as const).map((granularity,index)=><View key={granularity} style={{gap:4}}>
        <Text accessibilityRole="header" style={{color:theme.textSecondary}}>{['この日','週','月'][index]}</Text>
        {state.items.filter(item=>item.granularity===granularity).map(item=><Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.label}、${formatTemporalRange(item)}`}
          disabled={state.isSaving} accessibilityState={{disabled:state.isSaving}} onPress={()=>onOpen(item.id)} style={{minHeight:52,paddingVertical:10,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap',borderBottomWidth:1,borderBottomColor:theme.calendarBorder}}>
          <Text style={{color:theme.text,fontSize:16}}>{item.label}</Text><Text style={{color:theme.textSecondary}}>{formatTemporalRange(item)} ›</Text>
        </Pressable>)}
      </View>)}
      <View style={{gap:8,paddingTop:16}}><Text accessibilityRole="header" style={{color:theme.textSecondary}}>終了が未定の予定</Text>
        {button(`未定の表示時間　${formatMinutes(pendingMinutes??state.minutes)}`,()=>setSelecting(true),state.isSaving)}
        <Text style={{color:theme.textSecondary}}>開始から薄くなるまでの表示時間です。終了時刻や通知の基準には使われません。保存済み予定の表示にも反映します。</Text>
        {pendingMinutes!==null&&pendingMinutes!==state.minutes?<>
          {button('表示時間を保存',()=>Alert.alert('表示時間の確認',`${formatMinutes(state.minutes)} → ${formatMinutes(pendingMinutes)}。保存済みの予定にも表示のみ反映します。`,[
            {text:'キャンセル',style:'cancel'}, {text:'保存',onPress:()=>{void state.saveMinutes(pendingMinutes).then(ok=>{if(ok)onChangeMinutes(null);});}},
          ]),state.isSaving)}
          {button('表示時間の変更を破棄',()=>onChangeMinutes(null),state.isSaving)}
        </>:null}
      </View>
    </>:null}
    <DurationWheelPicker visible={selecting} title="未定の表示時間" initialMinutes={pendingMinutes??state.minutes} maxHours={24} minimumMinutes={1} maximumMinutes={1440} formatValue={formatMinutes}
      onConfirm={onChangeMinutes} onClose={()=>setSelecting(false)}/>
  </ScrollView>;
}
