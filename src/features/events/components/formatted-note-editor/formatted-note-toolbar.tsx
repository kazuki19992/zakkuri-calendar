import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import type { EditorSelectionState } from './formatted-note-editor.dom';

type Props = Readonly<{
  disabled: boolean;
  state: EditorSelectionState;
  onToggleBold(): void;
  onToggleItalic(): void;
  onToggleBulletList(): void;
  onToggleOrderedList(): void;
  onToggleTaskList(): void;
  onOpenLink(url: string): void;
}>;

export function FormattedNoteToolbar({
  disabled,
  state,
  onToggleBold,
  onToggleItalic,
  onToggleBulletList,
  onToggleOrderedList,
  onToggleTaskList,
  onOpenLink,
}: Props) {
  const theme = useTheme();
  const actions = [
    { label: '太字', text: 'B', selected: state.bold, onPress: onToggleBold },
    { label: '斜体', text: 'I', selected: state.italic, onPress: onToggleItalic },
    { label: '箇条書き', text: '•', selected: state.bulletList, onPress: onToggleBulletList },
    { label: '番号付きリスト', text: '1.', selected: state.orderedList, onPress: onToggleOrderedList },
    { label: 'チェックリスト', text: '☑', selected: state.taskList, onPress: onToggleTaskList },
  ] as const;
  return (
    <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.toolbar, { borderTopColor: theme.calendarBorder }]}>
      {actions.map((action) => (
        <Pressable key={action.label} accessibilityRole="button" accessibilityLabel={action.label}
          accessibilityState={{ disabled, selected: action.selected }} disabled={disabled}
          onPress={action.onPress} style={[styles.button, {
            backgroundColor: action.selected ? theme.backgroundSelected : theme.backgroundElement,
          }]}>
          <Text style={[styles.label, {
            color: action.selected ? theme.calendarAccent : theme.text,
            fontStyle: action.label === '斜体' ? 'italic' : 'normal',
            fontWeight: action.label === '太字' ? '700' : '500',
          }]}>{action.text}</Text>
        </Pressable>
      ))}
      <Pressable accessibilityRole="button" accessibilityLabel="リンクを開く"
        accessibilityState={{ disabled: disabled || state.linkUrl === null }}
        disabled={disabled || state.linkUrl === null}
        onPress={() => { if (state.linkUrl !== null) onOpenLink(state.linkUrl); }}
        style={[styles.linkButton, { backgroundColor: theme.backgroundElement }]}>
        <Text style={[styles.linkLabel, { color: theme.calendarAccent }]}>リンクを開く</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
    minHeight: 52,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  button: { alignItems: 'center', borderRadius: 8, justifyContent: 'center', minHeight: 44, minWidth: 44 },
  label: { fontSize: 18 },
  linkButton: { alignItems: 'center', borderRadius: 8, justifyContent: 'center', minHeight: 44, paddingHorizontal: 12 },
  linkLabel: { fontSize: 14, fontWeight: '600' },
});
