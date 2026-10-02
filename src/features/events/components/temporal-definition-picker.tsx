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

  const groupLabels = { day: '日内', week: '週', month: '月' } as const;
  const selectedIdWithFallback = selectedId ?? definitions[0].id;

  return (
    <EventSingleSelectField label="時間帯" value={selectedIdWithFallback}
      options={definitions.map((definition) => ({
        label: `${groupLabels[definition.granularity]}・${definition.label}`,
        value: definition.id,
      }))}
      disabled={disabled} testID="event-editor.temporal-definition-picker" onChange={onSelect} />
  );
}

const styles = StyleSheet.create({
  empty: { fontSize: 15 },
});
