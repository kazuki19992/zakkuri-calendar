import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Radii, Spacing, Typography } from '@/constants/theme';
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
    { id: 'bold', label: '太字', name: { ios: 'bold', android: 'format_bold', web: 'format_bold' },
      selected: state.bold, onPress: onToggleBold },
    { id: 'italic', label: '斜体', name: { ios: 'italic', android: 'format_italic', web: 'format_italic' },
      selected: state.italic, onPress: onToggleItalic },
    { id: 'bullet-list', label: '箇条書き', name: { ios: 'list.bullet', android: 'format_list_bulleted', web: 'format_list_bulleted' },
      selected: state.bulletList, onPress: onToggleBulletList },
    { id: 'ordered-list', label: '番号付きリスト', name: { ios: 'list.number', android: 'format_list_numbered', web: 'format_list_numbered' },
      selected: state.orderedList, onPress: onToggleOrderedList },
    { id: 'check-list', label: 'チェックリスト', name: { ios: 'checklist', android: 'checklist', web: 'checklist' },
      selected: state.taskList, onPress: onToggleTaskList },
  ] as const;
  return (
    <View style={[styles.toolbar, { borderBottomColor: theme.calendarBorder }]}>
      {actions.map((action) => (
        <Pressable key={action.id} accessibilityRole="button" accessibilityLabel={action.label}
          accessibilityState={{ disabled, selected: action.selected }} disabled={disabled}
          onPress={action.onPress} style={({ pressed }) => [styles.button,
            (action.selected || pressed) && { backgroundColor: theme.backgroundSelected }]}>
          <SymbolView testID={`note-toolbar.${action.id}-icon`} name={action.name} size={20} accessible={false}
            tintColor={disabled ? theme.textDisabled : action.selected ? theme.calendarAccentText : theme.text} />
        </Pressable>
      ))}
      <Pressable accessibilityRole="button" accessibilityLabel="選択したリンクを開く"
        accessibilityState={{ disabled: disabled || state.linkUrl === null }}
        disabled={disabled || state.linkUrl === null}
        onPress={() => { if (state.linkUrl !== null) onOpenLink(state.linkUrl); }}
        style={[styles.button, styles.linkButton]}>
        <Text style={[styles.linkLabel, { color: disabled || state.linkUrl === null ? theme.textDisabled : theme.calendarAccentText }]}>リンクを閲覧</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    minHeight: 52,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  button: {
    alignItems: 'center',
    borderRadius: Radii.small,
    justifyContent: 'center',
    maxWidth: '100%',
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: Spacing.two,
  },
  linkButton: { paddingHorizontal: Spacing.twelve },
  linkLabel: { fontSize: Typography.body, fontWeight: '600' },
});
