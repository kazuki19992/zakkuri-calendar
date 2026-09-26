import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

export function SettingsScreen() {
  const theme = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>設定</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20, paddingVertical: 24 },
  heading: { fontSize: 22, fontWeight: '500' },
});
