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
  return (
    <View style={[styles.header, { borderBottomColor: theme.calendarBorder }]}>
      <View style={styles.side}>
        <Pressable accessibilityRole="button" accessibilityLabel="キャンセル" disabled={busy} onPress={onCancel} style={styles.action}>
          <Text style={{ color: theme.calendarAccent }}>キャンセル</Text>
        </Pressable>
      </View>
      <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>
        {mode === 'edit' ? '予定を編集' : '予定を追加'}
      </Text>
      <View style={styles.side}>
        <Pressable accessibilityRole="button" accessibilityLabel="保存" disabled={busy || !ready} onPress={onSave} style={[styles.action, styles.rightAction]}>
          <Text style={{ color: theme.calendarAccent }}>{busy ? '保存中' : '保存'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', minHeight: 52, paddingHorizontal: 8 },
  side: { flex: 1 },
  action: { justifyContent: 'center', minHeight: 44, paddingHorizontal: 4 },
  rightAction: { alignItems: 'flex-end' },
  title: { flex: 1.4, fontSize: 17, fontWeight: '600', textAlign: 'center' },
});
