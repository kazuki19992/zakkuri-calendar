import { StyleSheet, Text } from 'react-native';
import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';
import { useTheme } from '@/hooks/use-theme';
import { EventSingleSelectField } from './event-single-select-field';

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

  const groupLabels = { day: 'この日', week: '週単位', month: '月単位' } as const;
  const selectedIdWithFallback = definitions.find((definition) => definition.id === selectedId)?.id
    ?? definitions[0].id;

  return (
    <EventSingleSelectField label="時間帯" value={selectedIdWithFallback}
      options={definitions.map((definition) => ({
        label: definition.label,
        value: definition.id,
        group: groupLabels[definition.granularity],
      }))}
      disabled={disabled} testID="event-editor.temporal-definition-picker" onChange={onSelect} />
  );
}

const styles = StyleSheet.create({
  empty: { fontSize: 15 },
});
