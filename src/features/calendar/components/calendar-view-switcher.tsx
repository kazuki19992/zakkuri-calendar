import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import type { CalendarViewMode } from '../hooks/use-calendar-view';

export function CalendarViewSwitcher({
  mode,
  onSelectMode,
}: Readonly<{ mode: CalendarViewMode; onSelectMode(mode: CalendarViewMode): void }>) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.container, { backgroundColor: theme.backgroundElement }]}
    >
      {([
        ['twoDay', '2日'],
        ['month', '月'],
      ] as const).map(([value, label]) => {
        const selected = mode === value;
        return (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityLabel={`${label}表示`}
            accessibilityState={{ selected }}
            onPress={() => onSelectMode(value)}
            style={({ pressed }) => [
              styles.button,
              selected && { backgroundColor: theme.backgroundSelected },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.label, { color: selected ? theme.text : theme.textSecondary }]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignSelf: 'center', borderRadius: 8, padding: 2 },
  button: { minHeight: 40, minWidth: 64, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  label: { fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.65 },
});
