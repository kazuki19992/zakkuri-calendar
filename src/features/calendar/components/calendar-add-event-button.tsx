import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Radii, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function CalendarAddEventButton({ onPress }: Readonly<{ onPress(): void }>) {
  const theme = useTheme();

  return (
    <Pressable accessibilityRole="button" accessibilityLabel="予定を追加" onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: theme.calendarAccent }, pressed && styles.pressed]}>
      <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={18}
        tintColor={theme.background} accessible={false} />
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.label, { color: theme.background }]}>予定を追加</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', borderRadius: Radii.large, flexDirection: 'row', gap: Spacing.two, minHeight: 44, paddingHorizontal: Spacing.twelve },
  label: { flexShrink: 1, fontSize: Typography.body, fontWeight: '600' },
  pressed: { opacity: 0.82 },
});
