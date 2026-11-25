import { Spacing, Typography } from '@/constants/theme';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { ALL_DAY_OVERFLOW_HEIGHT, type TwoDayViewModel } from '../two-day-view-model';

export function AllDayRegion({ day, height, hiddenCount, compact = false, onOpenAllDayList }: Readonly<{
  day: TwoDayViewModel;
  height: number;
  hiddenCount: number;
  compact?: boolean;
  onOpenAllDayList?(date: string): void;
}>) {
  const theme = useTheme();
  return <View testID="two-day-calendar.all-day-region" style={[styles.region, { height, borderBottomColor: theme.calendarBorder }]}>
    <View style={[styles.footer, hiddenCount > 0 ? styles.bottom : styles.top]}>
      {hiddenCount > 0 && !onOpenAllDayList ? <Text numberOfLines={1} style={[styles.label, { color: theme.textSecondary }]}>ほか{hiddenCount}件</Text>
        : hiddenCount > 0 ? <Pressable accessibilityRole="button"
        accessibilityLabel={`${day.dateLabel}の終日予定、ほか${hiddenCount}件`}
        onPress={() => onOpenAllDayList?.(day.date)}
        style={styles.more}>
        <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.label, { color: theme.calendarAccentText }]}>ほか{hiddenCount}件</Text>
      </Pressable> : <>
        {day.holidaySupport === 'unsupported' ? <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.label, { color: theme.textSecondary }]}>{compact ? '祝日未対応' : '祝日情報未対応'}</Text> : null}
      </>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  region: { flexShrink: 0, borderBottomWidth: StyleSheet.hairlineWidth },
  footer: { position: 'absolute', left: 0, right: 0, height: ALL_DAY_OVERFLOW_HEIGHT, justifyContent: 'center' },
  top: { top: 0 },
  bottom: { bottom: 0 },
  more: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.half },
  label: { fontSize: Typography.caption, textAlign: 'center' },
});
