import {useCallback,useState} from 'react';
import {useFocusEffect,useRouter} from 'expo-router';
import {useRepositories} from '@/data/sqlite/app-database-provider';
import {useCalendarRefresh} from '@/features/calendar/calendar-refresh-context';
import {useTemporalPreferences} from '@/features/settings/hooks/use-temporal-preferences';
import {useSettingsLeaveGuard} from '@/features/settings/hooks/use-settings-leave-guard';
import {TemporalPreferencesScreen} from '@/features/settings/screens/temporal-preferences-screen';
export default function TemporalPreferencesRoute(){
  const {calendars,settings,temporalDefinitions}=useRepositories();const {notifyChanged}=useCalendarRefresh();const router=useRouter();
  const state=useTemporalPreferences({calendars,settings,definitions:temporalDefinitions,onSaved:notifyChanged});
  const [pendingMinutes,setPendingMinutes]=useState<number|null>(null);
  const {reload}=state;
  useFocusEffect(useCallback(()=>{void reload();},[reload]));
  useSettingsLeaveGuard(pendingMinutes!==null&&pendingMinutes!==state.minutes,state.isSaving);
  return <TemporalPreferencesScreen state={state} pendingMinutes={pendingMinutes} onChangeMinutes={setPendingMinutes} onOpen={id=>router.push({pathname:'/settings/temporal/[id]',params:{id}})}/>;
}
