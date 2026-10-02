import { StyleSheet, View } from 'react-native';
import { EVENT_COLOR_PALETTE, getEventColor, type EventColorId } from '@/constants/event-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { EventSingleSelectField } from './event-single-select-field';

type EventColorSelection = EventColorId | 'calendar';

export function EventColorPicker({ calendarColorId, value, disabled, onChange }: Readonly<{
  calendarColorId: EventColorId;
  value: EventColorId | null;
  disabled: boolean;
  onChange(value: EventColorId | null): void;
}>) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const options = [
    { value: 'calendar' as const, label: 'カレンダーの色',
      color: getEventColor(calendarColorId, scheme) },
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
    ?? getEventColor(calendarColorId, scheme);
  return (
    <EventSingleSelectField label="予定の色" value={selectedValue} options={options}
      disabled={disabled} testID="event-editor.color-picker"
      leading={<View testID="event-editor.selected-color-swatch"
        style={[styles.swatch, { backgroundColor: selectedColor }]} />}
      onChange={(next) => onChange(next === 'calendar' ? null : next)} />
  );
}

const styles = StyleSheet.create({
  swatch: { borderRadius: 8, height: 16, marginRight: 4, width: 16 },
});
