import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import {
  SingleSelectSheet,
  type SingleSelectOption,
} from '@/shared/components/single-select-sheet';

type PickerValue = string | number;

export function EventSingleSelectField<T extends PickerValue>({
  label,
  value,
  options,
  disabled,
  testID,
  leading,
  onChange,
}: Readonly<{
  label: string;
  value: T;
  options: readonly SingleSelectOption<T>[];
  disabled: boolean;
  testID: string;
  leading?: ReactNode;
  onChange(value: T): void;
}>) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);
  const selectionDisabled = disabled || options.length === 0;
  const selectedLabel = selectedOption?.label ?? '未選択';

  return (
    <View style={[styles.row, { borderBottomColor: theme.calendarBorder }]}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      <Pressable testID={testID} accessibilityRole="button"
        accessibilityLabel={`${label}、${selectedLabel}、選択する`}
        accessibilityState={{ disabled: selectionDisabled }} disabled={selectionDisabled}
        onPress={() => setOpen(true)} style={styles.control}>
        {leading}
        <Text numberOfLines={1} style={[styles.value, { color: theme.text }]}>{selectedLabel}</Text>
        <Text accessibilityElementsHidden importantForAccessibility="no"
          style={[styles.chevron, { color: theme.textSecondary }]}>⌄</Text>
      </Pressable>
      <SingleSelectSheet visible={open} title={label} value={value} options={options}
        disabled={disabled} onSelect={onChange} onClose={() => setOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 4,
  },
  label: { fontSize: 15 },
  control: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    minHeight: 44,
    minWidth: 136,
  },
  value: { flexShrink: 1, fontSize: 15 },
  chevron: { fontSize: 18, marginLeft: 8 },
});
