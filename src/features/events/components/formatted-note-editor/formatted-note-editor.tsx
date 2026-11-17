import type {NoteUpdate,NoteResponse} from '../../event-note/inline-note-session';
import { useState, type Ref } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import type { EventNoteDocumentV1 } from '@/domain/calendar/event-note';
import { createDOMNavigationPolicy } from './dom-navigation-policy';
import FormattedNoteEditorDOM, {
  type EditorSelectionState,
  type EditorTheme,
  type FormattedNoteEditorDOMRef,
} from './formatted-note-editor.dom';

type Props = Readonly<{
  editorRef: Ref<FormattedNoteEditorDOMRef>;
  initialDocument: EventNoteDocumentV1 | null;
  theme: EditorTheme;
  onReady(): Promise<void>;
  onStateChange(state: EditorSelectionState): Promise<void>;
  onConversionFailure(): Promise<void>;
  onFailure(): Promise<void>;
  sessionId?:number;disabled?:boolean;fontScale?:number;
  onSnapshot?(response:NoteResponse):Promise<void>;
  onSnapshotFailure?(requestId:number):Promise<void>;
  onDocumentChange?(update:NoteUpdate):Promise<void>;
  onFocusChange?(focused:boolean):Promise<void>;
  onContentHeight?(height:number):Promise<void>;
}>;

export function FormattedNoteEditor({
  editorRef,
  initialDocument,
  theme,
  onReady,
  onStateChange,
  onConversionFailure,
  onFailure,sessionId,disabled,fontScale,onSnapshot,onSnapshotFailure,onDocumentChange,onFocusChange,onContentHeight,
}: Props) {
  const [navigationPolicy] = useState(() =>
    createDOMNavigationPolicy(Platform.OS !== 'android'));
  return (
    <View style={styles.editor}>
      {/* Expo DOM Componentsのimperative APIへrefを渡すため、render時のref受け渡しが必要。 */}
      <FormattedNoteEditorDOM ref={editorRef} initialDocument={initialDocument}
        sessionId={sessionId} disabled={disabled} fontScale={fontScale} onSnapshot={onSnapshot} onSnapshotFailure={onSnapshotFailure} onDocumentChange={onDocumentChange} onFocusChange={onFocusChange} onContentHeight={onContentHeight}
        theme={theme} onReady={onReady} onStateChange={onStateChange}
        onConversionFailure={onConversionFailure} onFailure={onFailure}
        dom={{
          containerStyle: styles.editor,
          scrollEnabled: true,
          nestedScrollEnabled: true,
          onError:()=>{void onFailure();},
          onContentProcessDidTerminate:()=>{void onFailure();},
          onRenderProcessGone:()=>{void onFailure();},
          useExpoDOMWebView: false,
          unstable_useExpoModulesBridge: false,
          onLoadStart: (event: { nativeEvent: { url: string } }) => {
            navigationPolicy.seedDocumentUrl(event.nativeEvent.url);
          },
          onShouldStartLoadWithRequest: navigationPolicy.shouldStart,
        }} />
    </View>
  );
}

const styles = StyleSheet.create({ editor: { flex: 1 } });
