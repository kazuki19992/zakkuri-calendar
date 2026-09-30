import { StyleSheet, TextInput, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

export function EventMetadataFields({ location, notes, disabled, field = 'both', onLocationChange, onNotesChange }: Readonly<{
  location: string;
  notes: string;
  disabled: boolean;
  field?: 'location' | 'notes' | 'both';
  onLocationChange(value: string): void;
  onNotesChange(value: string): void;
}>) {
  const theme = useTheme();
  const inputStyle = [styles.input, { borderColor: theme.calendarBorder, color: theme.text }];
  return (
    <View style={styles.fields}>
      {field !== 'notes' ? <TextInput accessibilityLabel="場所" placeholder="場所を追加" placeholderTextColor={theme.textSecondary} value={location} onChangeText={onLocationChange} editable={!disabled} style={inputStyle} /> : null}
      {field !== 'location' ? <TextInput accessibilityLabel="メモ" placeholder="メモを追加" placeholderTextColor={theme.textSecondary} value={notes} onChangeText={onNotesChange} editable={!disabled} multiline textAlignVertical="top" style={[inputStyle, styles.notes]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 10 },
  input: { borderRadius: 8, borderWidth: 1, fontSize: 16, minHeight: 48, paddingHorizontal: 12, paddingVertical: 10 },
  notes: { minHeight: 112 },
});
