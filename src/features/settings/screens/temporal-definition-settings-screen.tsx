import {Modal,Pressable,ScrollView,Text,View} from 'react-native';
import {useTheme} from '@/hooks/use-theme';
import type {useTemporalDefinitionSettings} from '../hooks/use-temporal-definition-settings';
import {TemporalRangeFields} from '../components/temporal-range-fields';
import {TemporalPreview} from '../components/temporal-preview';
import {formatPercent,formatTemporalRange} from '../temporal-preferences-model';
export function TemporalDefinitionSettingsScreen({state,onSaved}:{state:ReturnType<typeof useTemporalDefinitionSettings>;onSaved():void}){
  const theme=useTheme();
  const button=(label:string,onPress:()=>void,disabled=false,accessibilityLabel=label)=><Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
    style={{minHeight:44,justifyContent:'center',paddingVertical:8,paddingHorizontal:10,minWidth:44,opacity:disabled ? .5 : 1}}><Text style={{color:theme.calendarAccent,fontSize:16}}>{label}</Text></Pressable>;
  if(state.status!=='ready'||!state.draft)return <ScrollView style={{backgroundColor:theme.background}} contentContainerStyle={{padding:20}}><Text style={{color:theme.text}}>{state.status==='loading'?'読み込み中…':state.error}</Text>{state.status==='error'?button('再読み込み',state.reload):null}</ScrollView>;
  const d=state.draft;
  return <ScrollView style={{backgroundColor:theme.background}} contentContainerStyle={{padding:20,gap:24,paddingBottom:48}}>
    <TemporalRangeFields definition={d} onChange={state.edit} disabled={state.isSaving}/>
    <View style={{gap:12}}><Text accessibilityRole="header" style={{color:theme.text,fontSize:17}}>ぼかし</Text>
      {(['fadeInRatio','fadeOutRatio'] as const).map((key,index)=>{
        const label=index===0?'開始側をぼかす':'終了側をぼかす';const value=d[key];const max=1-d[index===0?'fadeOutRatio':'fadeInRatio'];
        const change=(delta:number)=>state.edit({[key]:Math.min(max,Math.max(0,Math.round((value+delta)*1e10)/1e10))});
        return <View key={key} style={{gap:4}}><Text style={{color:theme.text}}>{label}　{formatPercent(value)}{value===0?'（ぼかさない）':''}</Text>
          <View style={{flexDirection:'row',gap:28}}>{button('−',()=>change(-.05),state.isSaving||value<=0,`${d.label}、${label}を減らす、現在${formatPercent(value)}`)}{button('＋',()=>change(.05),state.isSaving||value>=max,`${d.label}、${label}を増やす、現在${formatPercent(value)}`)}</View></View>;
      })}
      <Text style={{color:theme.textSecondary}}>範囲全体に対する長さです。開始側と終了側の合計は100%まで設定できます。</Text>
    </View>
    {!state.validationError?<TemporalPreview definition={d}/>:<Text accessibilityRole="alert" style={{color:theme.calendarHoliday}}>{state.validationError}</Text>}
    <Text style={{color:theme.textSecondary}}>この時間表現を使う保存済みの予定にも反映されます。今後の通知時刻が変わる場合があります。</Text>
    {state.error?<Text accessibilityRole="alert" style={{color:theme.calendarHoliday}}>{state.error}</Text>:null}
    {button('初期値に戻す',state.restore,state.isSaving)}
    {button(state.isSaving?'保存内容を処理中…':'変更内容を確認',()=>{void state.prepareSave();},state.isSaving||!state.dirty||!!state.validationError)}
    <Modal visible={state.preview!==null} transparent animationType="none" onRequestClose={state.cancelPreview}>
      <View style={{flex:1,backgroundColor:theme.calendarBackdrop,justifyContent:'center',padding:24}}>
        <ScrollView style={{maxHeight:'85%',flexGrow:0,backgroundColor:theme.background,borderRadius:12}} contentContainerStyle={{padding:20,gap:16}} accessibilityViewIsModal>
          <Text accessibilityRole="header" style={{color:theme.text,fontSize:18}}>変更内容の確認</Text>
          {state.preview?<><Text style={{color:theme.text}}>{d.label}: {formatTemporalRange(state.preview.definition)} → {formatTemporalRange(state.preview.next)}</Text>
            <Text style={{color:theme.text}}>開始のぼかし: {formatPercent(state.preview.definition.fadeInRatio)} → {formatPercent(state.preview.next.fadeInRatio)}{ '\n' }終了のぼかし: {formatPercent(state.preview.definition.fadeOutRatio)} → {formatPercent(state.preview.next.fadeOutRatio)}</Text>
            <Text style={{color:theme.text}}>参照する保存済み予定: {state.preview.count}件。繰り返しはシリーズごとに1件です。過去の予定にも反映し、今後の通知時刻が変わる場合があります。</Text></>:null}
          {button('キャンセル',state.cancelPreview,state.isSaving)}
          {button('保存',()=>{void state.confirmSave().then(ok=>{if(ok)onSaved();});},state.isSaving)}
        </ScrollView>
      </View>
    </Modal>
  </ScrollView>;
}
