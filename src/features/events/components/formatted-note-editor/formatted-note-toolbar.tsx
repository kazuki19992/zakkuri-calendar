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
    { label: '太字', text: '太字', selected: state.bold, onPress: onToggleBold },
    { label: '斜体', text: '斜体', selected: state.italic, onPress: onToggleItalic },
    { label: '箇条書き', text: '箇条書き', selected: state.bulletList, onPress: onToggleBulletList },
    { label: '番号付きリスト', text: '番号付き', selected: state.orderedList, onPress: onToggleOrderedList },
    { label: 'チェックリスト', text: 'チェック', selected: state.taskList, onPress: onToggleTaskList },
  ] as const;
  return (
    <View style={[styles.toolbar, { borderBottomColor: theme.calendarBorder }]}>
      {actions.map((action) => (
        <Pressable key={action.label} accessibilityRole="button" accessibilityLabel={action.label}
          accessibilityState={{ disabled, selected: action.selected }} disabled={disabled}
          onPress={action.onPress} style={({ pressed }) => [styles.button,
            (action.selected || pressed) && { backgroundColor: theme.backgroundSelected }]}>
          <Text style={[styles.label, {
            color: disabled ? theme.textDisabled : action.selected ? theme.calendarAccent : theme.text,
            fontStyle: action.label === '斜体' ? 'italic' : 'normal',
            fontWeight: action.label === '太字' ? '700' : '500',
          }]}>{action.text}</Text>
        </Pressable>
      ))}
      <Pressable accessibilityRole="button" accessibilityLabel="選択したリンクを開く"
        accessibilityState={{ disabled: disabled || state.linkUrl === null }}
        disabled={disabled || state.linkUrl === null}
        onPress={() => { if (state.linkUrl !== null) onOpenLink(state.linkUrl); }}
        style={[styles.button, styles.linkButton]}>
        <Text style={[styles.linkLabel, { color: disabled || state.linkUrl === null ? theme.textDisabled : theme.calendarAccent }]}>リンクを閲覧</Text>
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
  label: { fontSize: Typography.caption },
  linkButton: { paddingHorizontal: Spacing.twelve },
  linkLabel: { fontSize: Typography.body, fontWeight: '600' },
});
