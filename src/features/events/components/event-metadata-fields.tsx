import { StyleSheet, TextInput, View } from 'react-native';
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

const styles = StyleSheet.create({
  fields: { gap: 10 },
  input: { borderRadius: 8, borderWidth: 1, fontSize: 16, minHeight: 48, paddingHorizontal: 12, paddingVertical: 10 },
});
