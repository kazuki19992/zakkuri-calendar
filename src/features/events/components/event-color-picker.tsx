import { Pressable, StyleSheet, Text, View } from 'react-native';
import { EVENT_COLOR_PALETTE, getEventColor, type EventColorId } from '@/constants/event-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

export function EventColorPicker({ calendarColorId, value, disabled, onChange }: Readonly<{
  calendarColorId: EventColorId;
  value: EventColorId | null;
  disabled: boolean;
  onChange(value: EventColorId | null): void;
}>) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const options = [
    { id: null, label: 'カレンダーの色', color: getEventColor(calendarColorId, scheme) },
    ...EVENT_COLOR_PALETTE.map((item) => ({ id: item.id, label: item.label, color: item[scheme] })),
  ] as const;
  return (
    <View style={styles.options}>
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <Pressable key={option.id ?? 'calendar'} accessibilityRole="button" accessibilityLabel={option.label} accessibilityState={{ disabled, selected }} disabled={disabled} onPress={() => onChange(option.id)} style={[styles.option, { backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement }]}>
            <View style={[styles.swatch, { backgroundColor: option.color }]} />
            <Text style={[styles.text, { color: theme.text }]}>{selected ? '✓ ' : ''}{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', minHeight: 44, paddingHorizontal: 10 },
  swatch: { borderRadius: 8, height: 16, marginRight: 7, width: 16 },
  text: { fontSize: 14 },
});
