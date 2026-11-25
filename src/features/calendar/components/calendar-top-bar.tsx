import { SymbolView } from 'expo-symbols';
import { useLayoutEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Radii, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CalendarTopBarModel } from '../calendar-top-bar-model';

export const CALENDAR_TOP_BAR_HEIGHT = 52;
const YEAR_LINE_HEIGHT = 14;
const YEAR_TRANSITION_DURATION_MS = 200;

export function CalendarTopBar({
  model,
  isLoading,
  reduceMotion = false,
  onOpenMenu,
  onToggleDatePicker,
  onToday,
}: Readonly<{
  model: CalendarTopBarModel;
  isLoading: boolean;
  reduceMotion?: boolean;
  onOpenMenu(): void;
  onToggleDatePicker(): void;
  onToday(): void;
}>) {
  const theme = useTheme();
  const { yearLabel } = model;
  const showsYear = yearLabel !== null;
  const [lastYearLabel, setLastYearLabel] = useState(yearLabel);
  const [yearHeight, setYearHeight] = useState(YEAR_LINE_HEIGHT);
  const [yearProgress] = useState(() => new Animated.Value(showsYear ? 1 : 0));
  const previousVisibility = useRef(showsYear);

  // 消える年はフェードが終わるまで表示する。
  if ((showsYear || reduceMotion) && yearLabel !== lastYearLabel) setLastYearLabel(yearLabel);

  useLayoutEffect(() => {
    const changed = previousVisibility.current !== showsYear;
    previousVisibility.current = showsYear;
    const target = showsYear ? 1 : 0;
    if (reduceMotion) {
      yearProgress.setValue(target);
      return;
    }
    if (!changed) return;
    const transition = Animated.timing(yearProgress, {
      toValue: target,
      duration: YEAR_TRANSITION_DURATION_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
      isInteraction: false,
    });
    transition.start(({ finished }) => {
      if (finished && !showsYear) setLastYearLabel(null);
    });
    return () => transition.stop();
  }, [reduceMotion, showsYear, yearProgress]);

  const displayedYear = yearLabel ?? (reduceMotion ? null : lastYearLabel);
  return (
    <View testID="calendar.top-bar" style={styles.container}>
      <Pressable accessibilityRole="button" accessibilityLabel="表示メニューを開く"
        onPress={onOpenMenu} style={({ pressed }) => [styles.iconButton, pressed && { backgroundColor: theme.backgroundSelected }]}>
        <SymbolView name={{ ios: 'line.3.horizontal', android: 'menu', web: 'menu' }}
          size={22} tintColor={theme.text} accessible={false} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={model.accessibilityLabel}
        onPress={onToggleDatePicker}
        style={({ pressed }) => [styles.monthButton, pressed && { backgroundColor: theme.backgroundSelected }]}>
        <Animated.View aria-hidden testID="calendar.top-bar.year-row" style={[styles.yearRow, {
          height: Animated.multiply(yearProgress, yearHeight), opacity: yearProgress,
        }]}>
          {displayedYear === null ? null : (
            <Text style={[styles.year, { color: theme.textSecondary }]}
              onLayout={(event) => setYearHeight(event.nativeEvent.layout.height)}>{displayedYear}</Text>
          )}
        </Animated.View>
        <View style={styles.monthLine}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.month, { color: theme.text }]}>{model.monthLabel}</Text>
          <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
            size={13} tintColor={theme.textSecondary} accessible={false} style={styles.chevron} />
        </View>
      </Pressable>
      <View style={styles.spacer} />
      <Pressable accessibilityRole="button" accessibilityLabel="今日へ移動"
        accessibilityState={{ disabled: isLoading }} disabled={isLoading}
        onPress={onToday} style={({ pressed }) => [
          styles.iconButton, styles.todayButton, pressed && { backgroundColor: theme.backgroundSelected },
        ]}>
        <Text style={[styles.todayLabel, { color: isLoading ? theme.textDisabled : theme.text }]}>今日</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: CALENDAR_TOP_BAR_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.twelve, gap: Spacing.two },
  iconButton: { minWidth: 44, minHeight: 44, borderRadius: Radii.small, alignItems: 'center', justifyContent: 'center' },
  monthButton: { minHeight: 44, minWidth: 72, flexShrink: 1, borderRadius: Radii.small, justifyContent: 'center', paddingHorizontal: Spacing.one },
  yearRow: { overflow: 'hidden' },
  year: { position: 'absolute', left: 0, bottom: 0, fontSize: Typography.caption, lineHeight: YEAR_LINE_HEIGHT },
  monthLine: { flexDirection: 'row', alignItems: 'center' },
  month: { fontSize: Typography.display, fontWeight: '700', flexShrink: 1 },
  chevron: { marginLeft: Spacing.one },
  spacer: { flex: 1 },
  todayButton: { paddingHorizontal: Spacing.twelve },
  todayLabel: { fontSize: Typography.body, fontWeight: '400' },
});
