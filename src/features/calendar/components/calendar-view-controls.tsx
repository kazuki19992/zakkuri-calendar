import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';
import { Radii, Spacing } from '@/constants/theme';
import type { CalendarViewMode } from '@/domain/calendar/calendar-view-mode';
import { useTheme } from '@/hooks/use-theme';
import { SegmentedControl } from '@/shared/components/segmented-control';

const modes = [
  { value: 'day', label: '1日', accessibilityLabel: '1日表示' },
  { value: 'twoDay', label: '2日', accessibilityLabel: '2日表示' },
  { value: 'week', label: '週', accessibilityLabel: '週表示' },
  { value: 'month', label: '月', accessibilityLabel: '月表示' },
] as const;

const movement = {
  day: ['前日へ移動', '翌日へ移動'],
  twoDay: ['前日へ移動', '翌日へ移動'],
  week: ['前週へ移動', '翌週へ移動'],
  month: ['前月へ移動', '翌月へ移動'],
} as const;

export function CalendarViewControls({ mode, isPeriodBusy, isModeBusy, reduceMotion, onSelect, onPrevious, onNext }: Readonly<{
  mode: CalendarViewMode;
  isPeriodBusy: boolean;
  isModeBusy: boolean;
  reduceMotion: boolean;
  onSelect(mode: CalendarViewMode): void;
  onPrevious(): void;
  onNext(): void;
}>) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: theme.calendarBorder }]}>
      <View style={styles.modes}>
        <SegmentedControl options={modes} value={mode} label="カレンダーの表示形式" role="tab"
          onSelect={onSelect} disabled={isModeBusy} animateSelection={!reduceMotion} />
      </View>
      <View style={styles.arrows}>
        {([['left', movement[mode][0], onPrevious], ['right', movement[mode][1], onNext]] as const)
          .map(([direction, label, action]) => (
            <Pressable key={direction} accessibilityRole="button" accessibilityLabel={label}
              accessibilityState={{ disabled: isPeriodBusy }} disabled={isPeriodBusy}
              onPress={action} style={({ pressed }) => [styles.arrow, pressed && { backgroundColor: theme.backgroundSelected }]}>
              <SymbolView name={direction === 'left'
                ? { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }
                : { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                size={16} accessible={false} tintColor={isPeriodBusy ? theme.textDisabled : theme.text} />
            </Pressable>
          ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.twelve, paddingBottom: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth },
  modes: { flex: 1, minWidth: 0, maxWidth: 360 },
  arrows: { flexDirection: 'row', marginLeft: 'auto' },
  arrow: { minWidth: 44, minHeight: 44, borderRadius: Radii.small, alignItems: 'center', justifyContent: 'center' },
});
