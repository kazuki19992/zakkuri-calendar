import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';
import { useTheme } from '@/hooks/use-theme';

type TemporalDefinitionPickerProps = Readonly<{
  definitions: readonly TemporalDefinition[];
  selectedId: string | null;
  disabled: boolean;
  onSelect(id: string): void;
}>;

export function TemporalDefinitionPicker({
  definitions,
  selectedId,
  disabled,
  onSelect,
}: TemporalDefinitionPickerProps) {
  const theme = useTheme();

  if (definitions.length === 0) {
    return <Text style={[styles.empty, { color: theme.textSecondary }]}>利用できる時間帯がありません</Text>;
  }

  const groups = [
    ['day', '日内'],
    ['week', '週'],
    ['month', '月'],
  ] as const;

  return (
    <View style={styles.groups}>
      {groups.map(([granularity, label]) => {
        const items = definitions.filter((definition) => definition.granularity === granularity);
        if (items.length === 0) return null;
        return <View key={granularity} style={styles.group}>
          <Text style={[styles.heading, { color: theme.textSecondary }]}>{label}</Text>
          <View style={styles.list}>{items.map((definition) => {
            const selected = definition.id === selectedId;
            return <Pressable
              key={definition.id}
              accessibilityRole="button"
              accessibilityLabel={definition.label}
              accessibilityState={{ disabled, selected }}
              disabled={disabled}
              onPress={() => onSelect(definition.id)}
              style={({ pressed }) => [styles.button, {
                backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement,
              }, pressed && styles.pressed]}
            ><Text style={[styles.text, { color: theme.text }]}>{selected ? '✓ ' : ''}{definition.label}</Text></Pressable>;
          })}</View>
        </View>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  groups: { gap: 12 },
  group: { gap: 6 },
  heading: { fontSize: 13 },
  list: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { borderRadius: 8, justifyContent: 'center', minHeight: 44, paddingHorizontal: 16 },
  text: { fontSize: 16, fontWeight: '600' },
  empty: { fontSize: 15 },
  pressed: { opacity: 0.6 },
});
