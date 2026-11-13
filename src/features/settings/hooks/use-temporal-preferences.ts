import {useCallback,useEffect,useRef,useState} from 'react';
import type {CalendarRepository,SettingsRepository,TemporalDefinitionRepository} from '@/domain/calendar/repositories';
import type {TemporalDefinition} from '@/domain/temporal/temporal-definition';
import {parseUndeterminedMinutes} from '@/domain/temporal/temporal-preferences';
export function useTemporalPreferences({calendars,settings,definitions,onSaved}:{calendars:Pick<CalendarRepository,'getDefault'>;settings:Pick<SettingsRepository,'getUndeterminedFadeMinutes'|'setUndeterminedFadeMinutes'>;definitions:Pick<TemporalDefinitionRepository,'listEditable'>;onSaved():void}){
  const [items,setItems]=useState<readonly TemporalDefinition[]>([]),[minutes,setMinutes]=useState(120);
  const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
  const [error,setError]=useState<string|null>(null),[isSaving,setSaving]=useState(false);
  const mounted=useRef(false),generation=useRef(0),busy=useRef(false);
  useEffect(()=>{mounted.current=true;generation.current++;return()=>{mounted.current=false;};},[]);
  const reload=useCallback(async()=>{
    if(busy.current)return;
    const version=++generation.current;setStatus('loading');setError(null);
    try{
      const calendar=await calendars.getDefault();
      const [values,fade]=await Promise.all([definitions.listEditable(calendar.id),settings.getUndeterminedFadeMinutes()]);
      if(!mounted.current||version!==generation.current)return;
      setItems(values);setMinutes(fade);setStatus('ready');
    }catch{if(mounted.current&&version===generation.current){setStatus('error');setError('時間表現を読み込めませんでした');}}
  },[calendars,definitions,settings]);
  const saveMinutes=async(value:number)=>{
    if(busy.current||status!=='ready'||parseUndeterminedMinutes(value)===null)return false;
    busy.current=true;setSaving(true);setError(null);const version=generation.current;
    try{
      await settings.setUndeterminedFadeMinutes(value,new Date().toISOString());onSaved();
      if(!mounted.current||version!==generation.current)return false;
      setMinutes(value);return true;
    }catch{if(mounted.current&&version===generation.current)setError('保存できませんでした。変更内容を保持しています。再試行してください。');return false;}
    finally{busy.current=false;if(mounted.current&&version===generation.current)setSaving(false);}
  };
  return {items,minutes,status,error,isSaving,reload,saveMinutes};
}
