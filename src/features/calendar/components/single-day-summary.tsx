import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getEventColor } from '@/constants/event-colors';
import { useTheme } from '@/hooks/use-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { createDateRangeOpacityStops } from '../date-range-gradient';
import type { TwoDayViewModel } from '../two-day-view-model';

export function SingleDaySummary({ day, height, hidden = false, onEditEvent }: Readonly<{
  day: TwoDayViewModel; height: number; onEditEvent?(id: string, originalOccurrenceDate?: string): void;
  hidden?: boolean;
}>) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const priority = (item: TwoDayViewModel['allDayItems'][number]) => item.rangePosition !== undefined ? 0 : item.kind === 'holiday' ? 1 : 2;
  const items = [...day.allDayItems].sort((a, b) => priority(a) - priority(b));
  return <View style={styles.root} accessibilityElementsHidden={hidden} importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}>
    <Text accessibilityRole="header" style={[styles.date, { color: day.isToday ? theme.calendarAccent : theme.text }]}>{day.dateLabel}（{day.weekdayLabel}）</Text>
    <ScrollView testID={`single-day.all-day.${day.date}`} style={{ height }} nestedScrollEnabled>
      <Text style={{ color: theme.textSecondary }}>終日欄 {items.length}件</Text>
      {day.holidaySupport === 'unsupported' ? <Text style={{ color: theme.textSecondary }}>祝日情報未対応</Text> : null}
      {items.map((item) => {
        const color = item.colorId === 'holiday' ? theme.calendarHolidayBackground : getEventColor(item.colorId, scheme);
        const textColor = item.colorId === 'holiday' ? theme.calendarHoliday : theme.background;
        const stops = createDateRangeOpacityStops({ rangeStartDate: item.rangeStartDate ?? day.date, rangeThroughDate: item.rangeThroughDate ?? day.date,
          clipStartDate: day.date, clipThroughDate: day.date, fadeInRatio: item.fadeInRatio ?? 0, fadeOutRatio: item.fadeOutRatio ?? 0 });
        const content = <>
          <LinearGradient pointerEvents="none" colors={stops.map(({ opacity }) => `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`) as [string, string, ...string[]]}
            locations={stops.map(({ offset }) => offset) as [number, number, ...number[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          <Text style={[styles.label, { backgroundColor: color, color: textColor }]}>{item.title}</Text>
          <Text style={[styles.label, { backgroundColor: color, color: textColor }]}>{item.temporalLabel}</Text>
        </>;
        const style = [styles.item, item.kind === 'fuzzyRange' ? { borderStyle: 'dashed' as const, borderWidth: 1, borderColor: theme.textSecondary } : null,
          item.rangePosition === 'middle' || item.rangePosition === 'end' ? { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 } : null,
          item.rangePosition === 'middle' || item.rangePosition === 'start' ? { borderTopRightRadius: 0, borderBottomRightRadius: 0 } : null];
        return item.isInteractive ? <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.accessibilityLabel} style={style}
          onPress={() => { if (item.eventId !== null) {
            if (item.originalOccurrenceDate === undefined) onEditEvent?.(item.eventId);
            else onEditEvent?.(item.eventId, item.originalOccurrenceDate);
          } }}>{content}</Pressable>
          : <View key={item.id} accessible accessibilityRole="text" accessibilityLabel={item.accessibilityLabel} style={style}>{content}</View>;
      })}
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({ root: { flex: 1, minWidth: 0 }, date: { minHeight: 44, textAlign: 'center', paddingVertical: 10, fontSize: 16 },
  item: { minHeight: 44, borderRadius: 3, overflow: 'hidden', marginVertical: 1, marginHorizontal: 2, padding: 3, justifyContent: 'center' },
  label: { alignSelf: 'flex-start', fontSize: 12 } });
