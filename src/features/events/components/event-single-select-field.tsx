import { Spacing, Typography } from '@/constants/theme';
import { SymbolView } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
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
    <>
      <Pressable testID={testID} accessibilityRole="button"
        accessibilityLabel={`${label}、${selectedLabel}、選択する`}
        accessibilityState={{ disabled: selectionDisabled }} disabled={selectionDisabled}
        onPress={() => { Keyboard.dismiss(); setOpen(true); }}
        style={[styles.row, { borderBottomColor: theme.calendarBorder }]}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
        <View style={styles.control}>
          {leading}
          <Text style={[styles.value, { color: theme.text }]}>{selectedLabel}</Text>
          <SymbolView accessible={false} name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={12} tintColor={selectionDisabled ? theme.textDisabled : theme.textSecondary} style={styles.chevron} />
        </View>
      </Pressable>
      <SingleSelectSheet visible={open} title={label} value={value} options={options}
        disabled={disabled} onSelect={onChange} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingVertical: Spacing.one,
    paddingHorizontal: 0,
  },
  label: { fontSize: Typography.row },
  control: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginLeft: Spacing.two,
  },
  value: { flexShrink: 1, fontSize: Typography.row, textAlign: 'right' },
  chevron: { marginLeft: Spacing.two },
});
