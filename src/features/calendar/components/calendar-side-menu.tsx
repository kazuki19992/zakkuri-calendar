import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { getEventColor, getEventColorLabel, type EventColorId } from '@/constants/event-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import type { CalendarViewMode } from '../hooks/use-calendar-view';

const viewOptions = [['twoDay', '2日'], ['month', '月']] as const;
const CLOSED_TRANSLATE_X = -360;
const SLIDE_DURATION_MS = 220;

export function CalendarSideMenu({
  visible,
  mode,
  calendarName,
  calendarColorId,
  isCalendarVisible,
  isCalendarVisibilityUpdating,
  calendarVisibilityError,
  topInset,
  bottomInset,
  reduceMotion,
  onSelectMode,
  onSetCalendarVisible,
  onOpenSettings,
  onClose,
}: Readonly<{
  visible: boolean;
  mode: CalendarViewMode;
  calendarName: string;
  calendarColorId: EventColorId;
  isCalendarVisible: boolean;
  isCalendarVisibilityUpdating: boolean;
  calendarVisibilityError: string | null;
  topInset: number;
  bottomInset: number;
  reduceMotion: boolean;
  onSelectMode(mode: CalendarViewMode): Promise<boolean>;
  onSetCalendarVisible(visible: boolean): Promise<boolean>;
  onOpenSettings(): void;
  onClose(): void;
}>) {
  const theme = useTheme();
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [translateX] = useState(() => new Animated.Value(CLOSED_TRANSLATE_X));
  const closingRef = useRef(false);
  const [isSelecting, setSelecting] = useState(false);
  const isBusy = isSelecting || isCalendarVisibilityUpdating;

  useEffect(() => {
    if (!visible) return;
    closingRef.current = false;
    if (reduceMotion) {
      translateX.setValue(0);
      return;
    }
    translateX.setValue(CLOSED_TRANSLATE_X);
    Animated.timing(translateX, {
      toValue: 0,
      duration: SLIDE_DURATION_MS,
      useNativeDriver: true,
    }).start();
  }, [reduceMotion, translateX, visible]);

  const close = useCallback((afterClose?: () => void) => {
    if (closingRef.current) return;
    closingRef.current = true;
    const finish = () => {
      onClose();
      afterClose?.();
      closingRef.current = false;
    };
    if (reduceMotion) {
      finish();
      return;
    }
    Animated.timing(translateX, {
      toValue: CLOSED_TRANSLATE_X,
      duration: SLIDE_DURATION_MS,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) finish();
      else closingRef.current = false;
    });
  }, [onClose, reduceMotion, translateX]);

  const selectMode = async (nextMode: CalendarViewMode) => {
    if (isBusy) return;
    setSelecting(true);
    const succeeded = await onSelectMode(nextMode);
    setSelecting(false);
    if (succeeded) close();
  };

  const setCalendarVisible = async (nextVisible: boolean) => {
    if (isBusy) return;
    setSelecting(true);
    const succeeded = await onSetCalendarVisible(nextVisible);
    setSelecting(false);
    if (succeeded) close();
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent
      onRequestClose={() => close()}>
      <Pressable testID="calendar-side-menu.backdrop"
        style={[styles.backdrop, { backgroundColor: theme.calendarBackdrop }]}
        accessible={false} onPress={() => close()}>
        <Animated.View testID="calendar-side-menu.panel" accessibilityViewIsModal
          style={[styles.panel, {
            backgroundColor: theme.calendarOverlay,
            paddingTop: topInset + 12,
            paddingBottom: Math.max(bottomInset, 16),
            transform: [{ translateX }],
          }]}
          onStartShouldSetResponder={() => true}>
          <Text accessibilityRole="header" style={[styles.appName, { color: theme.text }]}>ざっくりカレンダー</Text>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>表示</Text>
          {viewOptions.map(([value, label]) => {
            const selected = mode === value;
            return (
              <Pressable key={value} accessibilityRole="menuitem" accessibilityLabel={`${label}表示`}
                accessibilityState={{ selected, disabled: isBusy }} disabled={isBusy}
                onPress={() => void selectMode(value)}
                style={({ pressed }) => [styles.row, selected && { backgroundColor: theme.backgroundSelected },
                  pressed && styles.pressed]}>
                <Text style={[styles.icon, { color: selected ? theme.calendarAccent : theme.textSecondary }]}>▦</Text>
                <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
              </Pressable>
            );
          })}
          <View style={[styles.divider, { backgroundColor: theme.calendarBorder }]} />
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>カレンダー</Text>
          <View style={styles.calendarRow}>
            <View accessible accessibilityLabel={`${calendarName}の色、${getEventColorLabel(calendarColorId)}`}
              style={[styles.colorDot, { backgroundColor: getEventColor(calendarColorId, colorScheme) }]} />
            <Text style={[styles.calendarName, { color: theme.text }]} numberOfLines={1}>{calendarName}</Text>
            <Switch accessibilityLabel={`${calendarName}を表示`} value={isCalendarVisible}
              disabled={isBusy} onValueChange={(value) => void setCalendarVisible(value)}
              trackColor={{ false: theme.calendarBorder, true: theme.calendarAccent }} />
          </View>
          {calendarVisibilityError === null ? null : (
            <Text accessibilityRole="alert" style={[styles.error, { color: theme.calendarHoliday }]}>
              {calendarVisibilityError}
            </Text>
          )}
          <View style={styles.spacer} />
          <View style={[styles.divider, { backgroundColor: theme.calendarBorder }]} />
          <Pressable accessibilityRole="button" accessibilityLabel="設定を開く"
            disabled={isBusy} onPress={() => close(onOpenSettings)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <Text style={[styles.icon, { color: theme.textSecondary }]}>⚙</Text>
            <Text style={[styles.label, { color: theme.text }]}>設定</Text>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  panel: {
    width: '80%',
    maxWidth: 360,
    height: '100%',
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 3, height: 0 },
    elevation: 12,
  },
  appName: { fontSize: 20, fontWeight: '600', paddingHorizontal: 20, paddingBottom: 24 },
  sectionLabel: { fontSize: 12, paddingHorizontal: 20, paddingVertical: 8 },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  icon: { width: 36, fontSize: 18, textAlign: 'center' },
  label: { flex: 1, fontSize: 16 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 8 },
  calendarRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  colorDot: { width: 16, height: 16, borderRadius: 4, marginRight: 16 },
  calendarName: { flex: 1, fontSize: 15, marginRight: 8 },
  error: { fontSize: 12, lineHeight: 16, paddingHorizontal: 20, paddingBottom: 8 },
  spacer: { flex: 1 },
  pressed: { opacity: 0.64 },
});
