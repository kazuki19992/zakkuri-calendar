import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import type { MonthDayViewModel } from '../month-view-model';
import { MonthGrid } from './month-grid';

function formatMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return `${year}年${monthNumber}月`;
}

export function CalendarDatePicker({
  visible, month, days, isLoading, error, topOffset, onPreviousMonth, onNextMonth, onSelectDate, onClose,
}: Readonly<{
  visible: boolean;
  month: string;
  days: readonly MonthDayViewModel[];
  isLoading: boolean;
  error: string | null;
  topOffset: number;
  onPreviousMonth(): void;
  onNextMonth(): void;
  onSelectDate(date: string): Promise<boolean>;
  onClose(): void;
}>) {
  const theme = useTheme();
  const [isSelecting, setSelecting] = useState(false);
  const disabled = isLoading || isSelecting;
  const select = async (date: string) => {
    if (disabled) return;
    setSelecting(true);
    const succeeded = await onSelectDate(date);
    setSelecting(false);
    if (succeeded) onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable testID="calendar-date-picker.backdrop" style={[styles.backdrop, {
        backgroundColor: theme.calendarBackdrop,
        paddingTop: topOffset,
      }]}
        accessible={false} onPress={onClose}>
        <View testID="calendar-date-picker.panel" accessibilityViewIsModal
          style={[styles.panel, { backgroundColor: theme.calendarOverlay }]}
          onStartShouldSetResponder={() => true}>
          <View style={styles.header}>
            <Pressable accessibilityRole="button" accessibilityLabel="前の月" disabled={disabled}
              onPress={onPreviousMonth} style={styles.headerButton}>
              <Text style={[styles.arrow, { color: theme.calendarAccent }]}>‹</Text>
            </Pressable>
            <Text accessibilityRole="header" accessibilityLabel="日付を選択"
              style={[styles.month, { color: theme.text }]}>{formatMonth(month)}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="次の月" disabled={disabled}
              onPress={onNextMonth} style={styles.headerButton}>
              <Text style={[styles.arrow, { color: theme.calendarAccent }]}>›</Text>
            </Pressable>
          </View>
          {disabled ? <ActivityIndicator testID="calendar-date-picker.loading" color={theme.calendarAccent} /> : null}
          {error === null ? null : <Text accessibilityRole="alert" style={[styles.error, { color: theme.calendarHoliday }]}>{error}</Text>}
          <MonthGrid variant="picker" days={days} onSelectDate={(date) => void select(date)} />
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, paddingHorizontal: 0 },
  panel: { width: '100%', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 0, elevation: 7, shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  header: { height: 44, flexDirection: 'row', alignItems: 'center' },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  arrow: { fontSize: 28 },
  month: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600' },
  error: { fontSize: 12, paddingHorizontal: 8, paddingBottom: 4 },
});
