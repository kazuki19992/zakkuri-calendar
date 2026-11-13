import {useCallback,useEffect,useRef,useState} from 'react';
import type {TemporalDefinitionRepository,TemporalUpdatePreview} from '@/domain/calendar/repositories';
import type {TemporalDefinition} from '@/domain/temporal/temporal-definition';
import {applyTemporalPatch,temporalDefinitionToken,type TemporalDefinitionPatch} from '@/domain/temporal/temporal-preferences';
import {createStandardTemporalDefinitions} from '@/domain/temporal/standard-definitions';

function patchBetween(original:TemporalDefinition,draft:TemporalDefinition):TemporalDefinitionPatch {
  return {
    ...(JSON.stringify(original.resolverConfig)!==JSON.stringify(draft.resolverConfig)?{resolverConfig:draft.resolverConfig}:{}),
    ...(original.fadeInRatio!==draft.fadeInRatio?{fadeInRatio:draft.fadeInRatio}:{}),
    ...(original.fadeOutRatio!==draft.fadeOutRatio?{fadeOutRatio:draft.fadeOutRatio}:{}),
  };
}
export function useTemporalDefinitionSettings({id,repository,onSaved}:{id:string;repository:TemporalDefinitionRepository;onSaved():void}) {
  const [original,setOriginal]=useState<TemporalDefinition|null>(null);
  const [draft,setDraft]=useState<TemporalDefinition|null>(null);
  const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
  const [preview,setPreview]=useState<TemporalUpdatePreview|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [isSaving,setSaving]=useState(false);
  const [revision,setRevision]=useState(0);
  const mounted=useRef(false), busy=useRef(false), generation=useRef(0);
  useEffect(()=>{
    mounted.current=true; const version=++generation.current;
    busy.current=false;
    void (async()=>{
      await Promise.resolve();
      if(!mounted.current||generation.current!==version)return;
      setSaving(false);setStatus('loading');setPreview(null);setError(null);setOriginal(null);setDraft(null);
      const value=await repository.getById(id);
      if(!mounted.current||generation.current!==version)return;
      if(!value?.isSystem)throw new Error('not editable');
      setOriginal(value);setDraft(value);setStatus('ready');
    })().catch(()=>{if(mounted.current&&generation.current===version){setStatus('error');setError('時間表現を読み込めませんでした');}});
    return()=>{mounted.current=false;generation.current=version+1;};
  },[id,repository,revision]);
  const edit=useCallback((patch:TemporalDefinitionPatch)=>{
    if(busy.current)return;
    setDraft(current=>current?{...current,...patch}:null);setPreview(null);setError(null);
  },[]);
  const dirty=!!original&&!!draft&&Object.keys(patchBetween(original,draft)).length>0;
  let validationError:string|null=null;
  if(original&&draft){try{applyTemporalPatch(original,patchBetween(original,draft));}catch{validationError='範囲とぼかしの値を確認してください';}}
  const prepareSave=async()=>{
    if(busy.current||!original||!draft||!dirty||validationError)return false;
    busy.current=true;setSaving(true);setError(null);const version=generation.current;
    try{
      const patch=patchBetween(original,draft);
      const next=await repository.previewUpdate(id,patch);
      if(!mounted.current||version!==generation.current)return false;
      if(temporalDefinitionToken(next.definition)!==temporalDefinitionToken(original)){
        setOriginal(next.definition);setDraft(next.next);setPreview(null);
        setError('他の変更が反映されました。入力内容を保持しています。変更内容を再確認してください。');return false;
      }
      setPreview(next);return true;
    }catch{if(mounted.current&&version===generation.current)setError('変更内容を確認できませんでした。再試行してください。');return false;}
    finally{if(version===generation.current){busy.current=false;if(mounted.current)setSaving(false);}}
  };
  const confirmSave=async()=>{
    if(busy.current||!preview||!original||!draft)return false;
    busy.current=true;setSaving(true);setError(null);const version=generation.current;
    try{
      await repository.updateDefinition({id,patch:patchBetween(original,draft),token:preview.token,now:new Date().toISOString()});
      onSaved();
      if(!mounted.current||version!==generation.current)return false;
      setOriginal(draft);setPreview(null);return true;
    }catch{if(mounted.current&&version===generation.current){setPreview(null);setError('保存できませんでした。入力内容を保持しています。変更内容を再確認して保存してください。');}return false;}
    finally{if(version===generation.current){busy.current=false;if(mounted.current)setSaving(false);}}
  };
  const restore=()=>{
    if(!draft||busy.current)return;
    const standard=createStandardTemporalDefinitions(draft.calendarId,draft.createdAt).find(item=>item.key===draft.key);
    if(standard)edit({resolverConfig:standard.resolverConfig,fadeInRatio:standard.fadeInRatio,fadeOutRatio:standard.fadeOutRatio});
  };
  return {status,draft,original,dirty,preview,error,validationError,isSaving,edit,restore,prepareSave,confirmSave,
    cancelPreview:()=>{if(!busy.current)setPreview(null);},reload:()=>{if(!busy.current)setRevision(value=>value+1);}};
}
