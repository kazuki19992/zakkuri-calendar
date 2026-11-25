import { Radii, Spacing } from '@/constants/theme';
import { StyleSheet, View } from 'react-native';
import { EVENT_COLOR_PALETTE, type EventColorId } from '@/constants/event-colors';
import { useTheme } from '@/hooks/use-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { EventSingleSelectField } from './event-single-select-field';

type EventColorSelection = EventColorId | 'calendar';

export function EventColorPicker({ value, disabled, onChange }: Readonly<{
  value: EventColorId | null;
  disabled: boolean;
  onChange(value: EventColorId | null): void;
}>) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const options = [
    { value: 'calendar' as const, label: 'カレンダーの色',
      color: theme.calendarEvent },
    ...EVENT_COLOR_PALETTE.map((item) => ({
      value: item.id,
      label: item.label,
      color: item[scheme],
    })),
  ] satisfies readonly Readonly<{
    value: EventColorSelection;
    label: string;
    color: string;
  }>[];
  const selectedValue: EventColorSelection = value ?? 'calendar';
  const selectedColor = options.find((option) => option.value === selectedValue)?.color
    ?? theme.calendarEvent;
  const selectionOptions = options.map((option) => ({
    value: option.value,
    label: option.label,
    accessory: <View testID={`event-editor.color-option-${option.value}-swatch`}
      style={[styles.swatch, { backgroundColor: option.color }]} />,
  }));
  return (
    <EventSingleSelectField label="予定の色" value={selectedValue} options={selectionOptions}
      disabled={disabled} testID="event-editor.color-picker"
      leading={<View testID="event-editor.selected-color-swatch"
        style={[styles.swatch, { backgroundColor: selectedColor }]} />}
      onChange={(next) => onChange(next === 'calendar' ? null : next)} />
  );
}

const styles = StyleSheet.create({
  swatch: { borderRadius: Radii.small, height: 16, marginRight: Spacing.one, width: 16 },
});
