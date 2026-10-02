import { Host, Picker } from '@expo/ui';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

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
  options: readonly Readonly<{ label: string; value: T }>[];
  disabled: boolean;
  testID: string;
  leading?: ReactNode;
  onChange(value: T): void;
}>) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: theme.calendarBorder }]}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      <View style={styles.control}>
        {leading}
        <Host matchContents={{ vertical: true }} style={styles.host}>
          <Picker appearance="menu" enabled={!disabled} selectedValue={value}
            onValueChange={onChange} testID={testID}>
            {options.map((option) => (
              <Picker.Item key={String(option.value)} label={option.label} value={option.value} />
            ))}
          </Picker>
        </Host>
      </View>
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
  control: { alignItems: 'center', flex: 1, flexDirection: 'row', justifyContent: 'flex-end' },
  host: { minWidth: 136 },
});
