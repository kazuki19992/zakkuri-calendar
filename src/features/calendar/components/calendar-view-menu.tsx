import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { useTheme } from '@/hooks/use-theme';
import type { CalendarViewMode } from '../hooks/use-calendar-view';

const viewOptions = [['twoDay', '2日'], ['month', '月']] as const;

export function CalendarViewMenu({ visible, mode, onSelectMode, onClose }: Readonly<{
  visible: boolean;
  mode: CalendarViewMode;
  onSelectMode(mode: CalendarViewMode): Promise<boolean>;
  onClose(): void;
}>) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const select = async (nextMode: CalendarViewMode) => {
    if (busy) return;
    setBusy(true);
    const succeeded = await onSelectMode(nextMode);
    setBusy(false);
    if (succeeded) onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable testID="calendar-view-menu.backdrop" style={[styles.backdrop, { backgroundColor: theme.calendarBackdrop }]}
        accessible={false} onPress={onClose}>
        <View accessibilityViewIsModal style={[styles.panel, { backgroundColor: theme.calendarOverlay }]}
          onStartShouldSetResponder={() => true}>
          <Text style={[styles.heading, { color: theme.textSecondary }]}>表示</Text>
          {viewOptions.map(([value, label]) => {
            const selected = mode === value;
            return (
              <Pressable key={value} accessibilityRole="menuitem" accessibilityLabel={`${label}表示`}
                accessibilityState={{ selected }} disabled={busy} onPress={() => void select(value)}
                style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
                <Text style={[styles.check, { color: theme.calendarAccent }]}>{selected ? '✓' : ''}</Text>
                <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, paddingTop: 56, paddingLeft: 8 },
  panel: { width: 200, borderRadius: 8, paddingVertical: 8, elevation: 6, shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  heading: { fontSize: 12, paddingHorizontal: 16, paddingVertical: 8 },
  item: { minHeight: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  check: { width: 28, fontSize: 17 },
  label: { fontSize: 15 },
  pressed: { opacity: 0.64 },
});
