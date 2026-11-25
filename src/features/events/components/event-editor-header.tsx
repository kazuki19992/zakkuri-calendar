import { Spacing, Typography } from '@/constants/theme';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

type Props = Readonly<{
  mode: 'create' | 'edit';
  busy: boolean;
  ready: boolean;
  onCancel(): void;
  onSave(): void;
}>;

export function EventEditorHeader({ mode, busy, ready, onCancel, onSave }: Props) {
  const theme = useTheme();
  const saveDisabled = busy || !ready;
  return (
    <View style={[styles.header, { borderBottomColor: theme.calendarBorder }]}>
      <View style={styles.side}>
        <Pressable accessibilityRole="button" accessibilityLabel="キャンセル" disabled={busy} onPress={onCancel}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: busy ? theme.textDisabled : theme.text }}>キャンセル</Text>
        </Pressable>
      </View>
      <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>
        {mode === 'edit' ? '予定を編集' : '予定を追加'}
      </Text>
      <View style={styles.side}>
        <Pressable accessibilityRole="button" accessibilityLabel="保存"
          accessibilityState={{ disabled: saveDisabled, busy }} disabled={saveDisabled} onPress={onSave}
          style={({ pressed }) => [styles.action, styles.save, pressed && styles.pressed]}>
          <Text numberOfLines={1} adjustsFontSizeToFit
            style={[styles.saveLabel, { color: saveDisabled ? theme.textDisabled : theme.calendarAccent }]}>
            {busy ? '保存中' : '保存'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', minHeight: 52, paddingHorizontal: Spacing.three },
  side: { flex: 1 },
  action: { justifyContent: 'center', minHeight: 44, paddingHorizontal: Spacing.one },
  save: { alignSelf: 'flex-end', minWidth: 54, maxWidth: '100%', paddingHorizontal: Spacing.twelve, alignItems: 'center' },
  saveLabel: { fontWeight: '600' },
  pressed: { opacity: 0.82 },
  title: { flex: 1.4, fontSize: Typography.row, fontWeight: '600', textAlign: 'center' },
});
