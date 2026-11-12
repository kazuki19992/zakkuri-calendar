import {useEffect,useState} from 'react';
import {useLocalSearchParams,useRouter,Stack} from 'expo-router';
import {useRepositories} from '@/data/sqlite/app-database-provider';
import {useCalendarRefresh} from '@/features/calendar/calendar-refresh-context';
import {useTemporalDefinitionSettings} from '@/features/settings/hooks/use-temporal-definition-settings';
import {useSettingsLeaveGuard} from '@/features/settings/hooks/use-settings-leave-guard';
import {TemporalDefinitionSettingsScreen} from '@/features/settings/screens/temporal-definition-settings-screen';
export default function TemporalDefinitionSettingsRoute(){
  const {id}=useLocalSearchParams<{id:string}>();const router=useRouter();const {temporalDefinitions}=useRepositories();const {notifyChanged}=useCalendarRefresh();
  const state=useTemporalDefinitionSettings({id:typeof id==='string'?id:'',repository:temporalDefinitions,onSaved:notifyChanged});
  const [leaving,setLeaving]=useState(false);
  useSettingsLeaveGuard(!leaving&&state.dirty,!leaving&&state.isSaving);
  useEffect(()=>{if(leaving)router.back();},[leaving,router]);
  return <><Stack.Screen options={{title:state.draft?.label??'時間表現'}}/><TemporalDefinitionSettingsScreen state={state} onSaved={()=>setLeaving(true)}/></>;
}
