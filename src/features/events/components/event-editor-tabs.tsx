import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { EventEditorTab } from '@/domain/calendar/event';
import { useTheme } from '@/hooks/use-theme';

export function EventEditorTabs({ value, disabled, onChange }: Readonly<{
  value: EventEditorTab;
  disabled: boolean;
  onChange(value: EventEditorTab): void;
}>) {
  const theme = useTheme();
  return (
    <View accessibilityRole="tablist" style={[styles.container, { backgroundColor: theme.backgroundElement }]}>
      {([['fuzzy', 'ざっくり'], ['exact', 'きっちり']] as const).map(([tab, label]) => {
        const selected = value === tab;
        return (
          <Pressable key={tab} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ disabled, selected }} disabled={disabled} onPress={() => onChange(tab)} style={[styles.tab, selected && { backgroundColor: theme.backgroundSelected }]}>
            <Text style={[styles.label, { color: selected ? theme.calendarAccent : theme.textSecondary }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 9, flexDirection: 'row', padding: 3 },
  tab: { alignItems: 'center', borderRadius: 7, flex: 1, justifyContent: 'center', minHeight: 44 },
  label: { fontSize: 15, fontWeight: '600' },
});
