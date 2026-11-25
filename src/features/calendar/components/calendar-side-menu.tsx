import { Host, Toggle } from '@expo/ui/swift-ui';
import { disabled, labelsHidden, tint, toggleStyle } from '@expo/ui/swift-ui/modifiers';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CALENDAR_COLOR_PRESETS, getCalendarColorPreset } from '@/constants/calendar-color-presets';
import { DEFAULT_CALENDAR_COLOR_ID, parsePrimaryCalendarColorId } from '@/domain/calendar/calendar-color';
import { DEFAULT_EVENT_COLOR_ID, type EventColorId } from '@/domain/calendar/event-color';
import { Radii, Spacing, Typography } from '@/constants/theme';
import { useCalendarAppearance } from '@/hooks/calendar-appearance-context';
import { SingleSelectSheet } from '@/shared/components/single-select-sheet';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

const AnimatedSafeAreaView = Animated.createAnimatedComponent(SafeAreaView);
const CLOSED_TRANSLATE_X = -360;
const SLIDE_DURATION_MS = 220;

export function CalendarSideMenu({
  visible,
  calendarName,
  calendarColorId,
  isCalendarVisible,
  isCalendarVisibilityUpdating,
  calendarVisibilityError,
  reduceMotion,
  onSetCalendarVisible,
  onOpenSettings,
  onClose,
}: Readonly<{
  visible: boolean;
  calendarName: string;
  calendarColorId: EventColorId;
  isCalendarVisible: boolean;
  isCalendarVisibilityUpdating: boolean;
  calendarVisibilityError: string | null;
  reduceMotion: boolean;
  onSetCalendarVisible(visible: boolean): Promise<boolean>;
  onOpenSettings(): void;
  onClose(): void;
}>) {
  const theme = useTheme();
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const appearance = useCalendarAppearance();
  const fallbackColor = calendarColorId === DEFAULT_EVENT_COLOR_ID ? null : parsePrimaryCalendarColorId(calendarColorId);
  const preset = getCalendarColorPreset(appearance?.colorId ?? fallbackColor ?? DEFAULT_CALENDAR_COLOR_ID);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const swatchColor = preset[colorScheme].accent;
  const [translateX] = useState(() => new Animated.Value(CLOSED_TRANSLATE_X));
  const closingRef = useRef(false);
  const isBusy = isCalendarVisibilityUpdating;
  const calendarVisibilityLabel = `${calendarName}を表示`;

  const setCalendarVisibility = (value: boolean) => {
    if (!isBusy && !closingRef.current) void onSetCalendarVisible(value);
  };

  useEffect(() => {
    if (!visible) {
      return;
    }
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
      setColorPickerOpen(false);
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

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent navigationBarTranslucent
      onRequestClose={() => close()}>
      <Pressable testID="calendar-side-menu.backdrop"
        style={[styles.backdrop, { backgroundColor: theme.calendarBackdrop }]}
        accessible={false} onPress={() => close()}>
        <AnimatedSafeAreaView testID="calendar-side-menu.panel" accessibilityViewIsModal
          style={[styles.panel, {
            backgroundColor: theme.calendarOverlay,
            transform: [{ translateX }],
          }]}
          onStartShouldSetResponder={() => true}>
          <ScrollView bounces={false}>
            <Text accessibilityRole="header" style={[styles.appName, { color: theme.text }]}>ざっくりカレンダー</Text>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>カレンダー</Text>
            <View style={styles.calendarRow}>
              {appearance ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`${calendarName}の色、${preset.label}`}
                  accessibilityHint="カレンダーの色を変更します" disabled={appearance.isBusy}
                  onPress={() => setColorPickerOpen(true)} style={styles.colorButton}>
                  <View style={[styles.colorDot, { backgroundColor: swatchColor }]} />
                </Pressable>
              ) : (
                <View accessible accessibilityLabel={`${calendarName}の色、${preset.label}`}
                  style={[styles.colorDot, styles.staticColorDot, { backgroundColor: swatchColor }]} />
              )}
              <Text style={[styles.calendarName, { color: theme.text }]} numberOfLines={1}>{calendarName}</Text>
              {/* iOSではスイッチのSwiftUI描画サイズに合わせて行中央へ配置する。 */}
              {Platform.OS === 'ios' ? (
                <Host matchContents alignment="center" testID="calendar-side-menu.visibility-switch-host">
                  <Toggle
                    testID="calendar-side-menu.visibility-switch"
                    label={calendarVisibilityLabel}
                    isOn={isCalendarVisible}
                    onIsOnChange={setCalendarVisibility}
                    modifiers={[toggleStyle('switch'), labelsHidden(), tint(theme.calendarAccent), disabled(isBusy)]}
                  />
                </Host>
              ) : (
                <Switch accessibilityLabel={calendarVisibilityLabel} value={isCalendarVisible}
                  disabled={isBusy} onValueChange={setCalendarVisibility}
                  trackColor={{ false: theme.calendarBorder, true: theme.calendarAccent }} />
              )}
            </View>
            {appearance?.error ? (
              <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>
                {appearance.error}
              </Text>
            ) : null}
            {calendarVisibilityError === null ? null : (
              <Text accessibilityRole="alert" style={[styles.error, { color: theme.calendarHoliday }]}>
                {calendarVisibilityError}
              </Text>
            )}
            <View style={[styles.divider, { backgroundColor: theme.calendarBorder }]} />
            <Pressable accessibilityRole="button" accessibilityLabel="設定を開く"
              disabled={isBusy} onPress={() => close(onOpenSettings)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <SymbolView name={{ ios: 'gearshape', android: 'settings', web: 'settings' }} size={20}
                tintColor={theme.textSecondary} accessible={false} style={styles.icon} />
              <Text style={[styles.label, { color: theme.text }]}>設定</Text>
            </Pressable>
          </ScrollView>
          {appearance && colorPickerOpen ? (
            <SingleSelectSheet visible={visible} title="カレンダーの色" value={appearance.colorId}
              options={CALENDAR_COLOR_PRESETS.map((item) => ({
                value: item.id,
                label: item.label,
                accessory: <View style={[styles.colorDot, { backgroundColor: item[colorScheme].accent }]} />,
              }))}
              onSelect={(value) => { void appearance.setColor(value); }}
              onClose={() => setColorPickerOpen(false)} />
          ) : null}
        </AnimatedSafeAreaView>
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
    paddingTop: Spacing.twelve,
    paddingBottom: Spacing.four,
  },
  appName: { fontSize: Typography.title, fontWeight: '600', paddingHorizontal: Spacing.four, paddingBottom: Spacing.four },
  sectionLabel: { fontSize: Typography.caption, paddingHorizontal: Spacing.four, paddingVertical: Spacing.two },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.twelve,
    paddingHorizontal: Spacing.two },
  icon: { marginHorizontal: Spacing.two },
  label: { flex: 1, fontSize: Typography.row },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.two },
  calendarRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.four },
  colorDot: { width: 16, height: 16, borderRadius: Radii.full },
  staticColorDot: { marginRight: Spacing.three },
  colorButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -Spacing.twelve },
  calendarName: { flex: 1, fontSize: Typography.row, marginRight: Spacing.two },
  error: { fontSize: Typography.caption, lineHeight: 16, paddingHorizontal: Spacing.four, paddingBottom: Spacing.two },
  pressed: { opacity: 0.64 },
});
