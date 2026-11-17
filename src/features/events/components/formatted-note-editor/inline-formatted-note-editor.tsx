import {ActivityIndicator,Pressable,StyleSheet,Text,View} from 'react-native';
import {useTheme} from '@/hooks/use-theme';
import type {InlineNoteEditorModel} from '../../hooks/use-inline-note-editor';
import {FormattedNoteEditor} from './formatted-note-editor';
import {FormattedNoteToolbar} from './formatted-note-toolbar';
export function InlineFormattedNoteEditor({model,linkError}:{model:InlineNoteEditorModel;linkError:string|null}){
  const theme=useTheme();
  const {snapshot,bindField,bindEditor,height,disabled,fontScale,onReady,onFailure,onStateChange,onConversionFailure,onSnapshot,onSnapshotFailure,onDocumentChange,onFocusChange,onContentHeight,retry}=model;
  return <View ref={bindField} onTouchStart={event=>event.stopPropagation()}>
    <View style={[styles.field,{height:height,borderColor:theme.calendarBorder,backgroundColor:theme.background}]}>
      <View style={styles.fill} accessibilityElementsHidden={!snapshot.ready} importantForAccessibility={snapshot.ready?'auto':'no-hide-descendants'}>
        <FormattedNoteEditor key={snapshot.sessionId} editorRef={bindEditor} sessionId={snapshot.sessionId}
          initialDocument={snapshot.seed} disabled={disabled||!snapshot.ready} fontScale={fontScale}
          theme={{background:theme.background,text:theme.text,textSecondary:theme.textSecondary,accent:theme.calendarAccent}}
          onReady={onReady} onFailure={onFailure} onStateChange={onStateChange}
          onConversionFailure={onConversionFailure}
          onSnapshot={onSnapshot} onSnapshotFailure={onSnapshotFailure} onDocumentChange={onDocumentChange}
          onFocusChange={onFocusChange} onContentHeight={onContentHeight}/>
      </View>
      {!snapshot.ready?<View style={[styles.overlay,{backgroundColor:theme.background}]}>
        {snapshot.error===null?<ActivityIndicator accessibilityLabel="メモエディタを読み込み中"/>:<Text accessibilityRole="alert" style={{color:theme.calendarHoliday}}>メモエディタを読み込めませんでした。</Text>}
      </View>:null}
    </View>
    {snapshot.error!==null?<View>
      <Text accessibilityRole="alert" style={{color:theme.calendarHoliday}}>{snapshot.ready?'メモの内容を確認できませんでした。再試行してください。':snapshot.everReady?'最後に取得できたメモを保持しています。保存前に再読み込みしてください。':'元のメモのまま予定を保存できます。'}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="メモを再試行" disabled={disabled} accessibilityState={{disabled:disabled}} onPress={retry} style={styles.retry}><Text style={{color:theme.calendarAccent}}>再試行</Text></Pressable>
    </View>:null}
    {linkError?<Text accessibilityRole="alert" style={{color:theme.calendarHoliday}}>{linkError}</Text>:null}
  </View>;
}
export function InlineNoteToolbar({model,onOpenLink}:{model:InlineNoteEditorModel;onOpenLink(url:string):void}){
  const {focused,disabled,snapshot,selection,onToolbarTouchStart,onToolbarTouchEnd,toggleBold,toggleItalic,toggleBulletList,toggleOrderedList,toggleTaskList}=model;
  if(!focused)return null;
  return <View onTouchStart={onToolbarTouchStart} onTouchEnd={onToolbarTouchEnd}>
    <FormattedNoteToolbar disabled={disabled||!snapshot.ready} state={selection}
      onToggleBold={toggleBold} onToggleItalic={toggleItalic}
      onToggleBulletList={toggleBulletList} onToggleOrderedList={toggleOrderedList}
      onToggleTaskList={toggleTaskList} onOpenLink={onOpenLink}/>
  </View>;
}
const styles=StyleSheet.create({fill:{flex:1},field:{borderWidth:StyleSheet.hairlineWidth,borderRadius:8,overflow:'hidden'},overlay:{...StyleSheet.absoluteFill,alignItems:'center',justifyContent:'center',padding:12},retry:{minHeight:44,justifyContent:'center'}});
