import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

export function EventMetadataFields({ location, disabled, onLocationChange }: Readonly<{
  location: string;
  disabled: boolean;
  onLocationChange(value: string): void;
}>) {
  const theme = useTheme();
  const inputStyle = [styles.input, { borderColor: theme.calendarBorder, color: theme.text }];
  return (
    <View style={styles.fields}>
      <TextInput accessibilityLabel="場所" placeholder="場所を追加"
        placeholderTextColor={theme.textSecondary} value={location}
        onChangeText={onLocationChange} editable={!disabled} style={inputStyle} />
    </View>
  );
}

export function EventNoteField({ summary, disabled, error, onPress }: Readonly<{
  summary: string;
  disabled: boolean;
  error: string | null;
  onPress(): void;
}>) {
  const theme = useTheme();
  const hasNote = summary.length > 0;
  return (
    <View style={styles.fields}>
      <Pressable accessibilityRole="button"
        accessibilityLabel={hasNote ? 'メモを編集' : 'メモを追加'}
        accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
        style={[styles.noteRow, { borderColor: theme.calendarBorder }]}>
        <Text numberOfLines={2} style={[styles.noteSummary, {
          color: hasNote ? theme.text : theme.textSecondary,
        }]}>{hasNote ? summary : 'メモを追加'}</Text>
        <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          style={[styles.disclosure, { color: theme.textSecondary }]}>›</Text>
      </Pressable>
      {error === null ? null : (
        <Text accessibilityRole="alert" style={{ color: theme.calendarHoliday }}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 10 },
  input: { borderRadius: 8, borderWidth: 1, fontSize: 16, minHeight: 48, paddingHorizontal: 12, paddingVertical: 10 },
  noteRow: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', minHeight: 52, paddingHorizontal: 12, paddingVertical: 8 },
  noteSummary: { flex: 1, fontSize: 16, lineHeight: 22 },
  disclosure: { fontSize: 24, marginLeft: 12 },
});
