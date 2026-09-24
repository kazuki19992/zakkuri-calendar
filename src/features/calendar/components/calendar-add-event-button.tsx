import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

export function CalendarAddEventButton({ onPress }: Readonly<{ onPress(): void }>) {
  const theme = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel="予定を追加" onPress={onPress} style={({ pressed }) => [styles.button, { backgroundColor: theme.calendarAccent }, pressed && styles.pressed]}><Text style={[styles.text, { color: theme.background }]}>＋</Text></Pressable>;
}
const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 28,
    bottom: 18,
    elevation: 3,
    height: 56,
    justifyContent: 'center',
    position: 'absolute',
    right: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    width: 56,
    zIndex: 10,
  },
  text: { fontSize: 30, fontWeight: '300', lineHeight: 32 },
  pressed: { opacity: 0.7 },
});
