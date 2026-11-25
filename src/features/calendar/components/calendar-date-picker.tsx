import { SymbolView } from 'expo-symbols';
import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Radii, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const monthRows = Array.from({ length: 3 }, (_, row) =>
  Array.from({ length: 4 }, (_, column) => row * 4 + column + 1));

export function CalendarDatePicker({ month, error, topOffset, reduceMotion = false, onSelectDate, onClose }: Readonly<{
  month: string;
  error: string | null;
  topOffset: number;
  reduceMotion?: boolean;
  onSelectDate(date: string): Promise<boolean>;
  onClose(): void;
}>) {
  const theme = useTheme();
  const [currentYear, currentMonth] = month.split('-').map(Number);
  const [year, setYear] = useState(currentYear);
  const [isSelecting, setSelecting] = useState(false);
  const [selectionFailed, setSelectionFailed] = useState(false);
  const selectingRef = useRef(false);
  const close = () => {
    if (!selectingRef.current) onClose();
  };
  const select = async (nextMonth: number) => {
    if (selectingRef.current) return;
    selectingRef.current = true;
    setSelecting(true);
    setSelectionFailed(false);
    try {
      const date = `${String(year).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}-01`;
      if (await onSelectDate(date)) onClose();
      else setSelectionFailed(true);
    } finally {
      selectingRef.current = false;
      setSelecting(false);
    }
  };
  return (
    <Modal visible transparent animationType={reduceMotion ? 'none' : 'fade'} statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
      <SafeAreaView testID="calendar-date-picker.backdrop" style={[styles.backdrop, {
        backgroundColor: theme.calendarBackdrop, paddingTop: topOffset,
      }]}>
        <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={close} />
        <ScrollView testID="calendar-date-picker.panel" accessibilityViewIsModal
          contentContainerStyle={styles.panelContent} style={[styles.panel, { backgroundColor: theme.calendarOverlay }]}>
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>年月を選択</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="年月選択を閉じる"
              disabled={isSelecting} onPress={close} style={styles.iconButton}>
              <SymbolView accessible={false} name={{ ios: 'xmark', android: 'close', web: 'close' }}
                size={16} tintColor={theme.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.heading}>
            <Pressable accessibilityRole="button" accessibilityLabel="前の年" disabled={isSelecting || year <= 1}
              onPress={() => setYear(year - 1)} style={styles.iconButton}>
              <SymbolView accessible={false} name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} size={16} tintColor={isSelecting || year <= 1 ? theme.textDisabled : theme.text} />
            </Pressable>
            <Text accessibilityLiveRegion="polite" style={[styles.year, { color: theme.text }]}>{year}年</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="次の年" disabled={isSelecting || year >= 9999}
              onPress={() => setYear(year + 1)} style={styles.iconButton}>
              <SymbolView accessible={false} name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={16} tintColor={isSelecting || year >= 9999 ? theme.textDisabled : theme.text} />
            </Pressable>
          </View>
          {error !== null || selectionFailed ? (
            <Text accessibilityRole="alert" style={[styles.error, { color: theme.calendarHoliday }]}>
              {error ?? '表示期間を読み込めませんでした'}
            </Text>
          ) : null}
          {monthRows.map((months) => (
            <View style={styles.monthRow} key={months[0]}>
              {months.map((number) => {
                const selected = year === currentYear && number === currentMonth;
                return (
                  <Pressable key={number} accessibilityRole="button" accessibilityLabel={`${year}年${number}月`}
                    accessibilityState={{ selected, disabled: isSelecting }} disabled={isSelecting}
                    onPress={() => void select(number)}
                    style={({ pressed }) => [
                      styles.month,
                      (selected || pressed) && { backgroundColor: theme.backgroundSelected },
                      selected && { borderWidth: 1, borderColor: theme.calendarAccent },
                    ]}>
                    <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: isSelecting ? theme.textDisabled : theme.text }}>{number}月</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, paddingHorizontal: Spacing.twelve, alignItems: 'center' },
  panel: { width: '100%', maxWidth: 440, flexGrow: 0, borderRadius: Radii.large },
  panelContent: { padding: Spacing.twelve, gap: Spacing.two },
  heading: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, fontSize: Typography.row, fontWeight: '600', marginLeft: Spacing.one },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  year: { flex: 1, textAlign: 'center', fontSize: Typography.row, fontWeight: '600' },
  monthRow: { flexDirection: 'row', gap: Spacing.two },
  month: { flex: 1, minWidth: 0, minHeight: 44, borderRadius: Radii.small, alignItems: 'center', justifyContent: 'center' },
  error: { fontSize: Typography.caption, paddingHorizontal: Spacing.one },
});
