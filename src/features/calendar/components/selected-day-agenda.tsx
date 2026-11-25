import { Radii, Spacing, Typography } from '@/constants/theme';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { AgendaItemViewModel } from '../month-view-model';
import { useTheme } from '@/hooks/use-theme';

export type SelectedDayAgendaProps = Readonly<{
  selectedDate: string;
  holidayName: string | null;
  holidaySupport: 'available' | 'unsupported';
  items: readonly AgendaItemViewModel[];
  isPreview?: boolean;
  onEditEvent?(id: string, originalOccurrenceDate?: string): void;
}>;

function formatSelectedDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${year}年${Number(month)}月${Number(day)}日`;
}

export function SelectedDayAgenda({
  selectedDate,
  holidayName,
  holidaySupport,
  items,
  onEditEvent,
  isPreview = false,
}: SelectedDayAgendaProps) {
  const theme = useTheme();

  const { fontScale } = useWindowDimensions();
  const [listHeight, setListHeight] = useState(0);
  const rowHeight = Math.ceil(48 * Math.max(1, fontScale));
  const overflowHeight = Math.ceil(30 * Math.max(1, fontScale));
  const overflowFits = listHeight >= overflowHeight;
  const visibleCount = !isPreview || items.length * rowHeight <= listHeight ? items.length
    : Math.max(0, Math.floor((listHeight - overflowHeight) / rowHeight));
  const hiddenCount = items.length - visibleCount;

  const rows = items.slice(0, visibleCount).map((item) => {
    const testID = item.kind === 'fuzzyRange' ? `selected-day-agenda.fuzzy-range.${item.id}` : undefined;
    if (isPreview) return (
      <View key={item.id} testID={testID} accessible accessibilityLabel={item.accessibilityLabel}
        style={[styles.previewItem, { height: rowHeight, borderTopColor: theme.calendarBorder }]}>
        <Text numberOfLines={1} style={[styles.previewItemTitle, { color: theme.text }]}>{item.title}</Text>
        <Text numberOfLines={1} style={[styles.itemMeta, { color: theme.textSecondary }]}>{item.temporalLabel}</Text>
      </View>
    );
    return (
      <Pressable key={item.id} testID={testID} accessibilityRole="button" accessibilityLabel={item.accessibilityLabel}
        onPress={() => item.originalOccurrenceDate === undefined
          ? onEditEvent?.(item.eventId)
          : onEditEvent?.(item.eventId, item.originalOccurrenceDate)}
        style={[
          styles.item,
          item.kind === 'fuzzyRange' && { borderColor: theme.calendarAccent },
          item.kind === 'fuzzyRange' && styles.fuzzyRangeItem,
        ]}>
        <Text style={[styles.itemTitle, { color: theme.text }]}>{item.title}</Text>
        <Text style={[styles.itemMeta, { color: theme.textSecondary }]}>{item.temporalLabel}</Text>
      </Pressable>
    );
  });

  return (
    <View style={isPreview ? styles.preview : [styles.container, { borderTopColor: theme.calendarBorder }]}>
      <View style={isPreview ? styles.previewHeader : undefined}>
        <Text accessibilityRole="header" numberOfLines={isPreview ? 1 : undefined}
          style={[styles.title, isPreview && styles.previewTitle, { color: theme.text }]}>
          {formatSelectedDate(selectedDate)}の予定
        </Text>
        {holidayName !== null ? (
          <Text numberOfLines={isPreview ? 1 : undefined}
            style={[styles.holiday, { color: theme.calendarHoliday }]}>{holidayName}</Text>
        ) : holidaySupport === 'unsupported' ? (
          <Text style={[styles.support, { color: theme.textSecondary }]}>祝日情報未対応</Text>
        ) : null}
      </View>
      {items.length === 0 ? (
        <Text style={[styles.empty, { color: theme.textSecondary }]}>予定はありません</Text>
      ) : isPreview ? (
        <View testID="calendar-day-preview.agenda" style={styles.previewList}
          onLayout={(event) => setListHeight(event.nativeEvent.layout.height)}>
          {rows}
          {hiddenCount > 0 && overflowFits ? (
            <View style={[styles.overflow, { height: overflowHeight, borderTopColor: theme.calendarBorder }]}>
              <Text numberOfLines={1} style={[styles.itemMeta, { color: theme.textSecondary }]}>ほか{hiddenCount}件</Text>
            </View>
          ) : null}
        </View>
      ) : rows}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.twelve, paddingVertical: Spacing.two },
  preview: { flex: 1, minHeight: 0 },
  previewHeader: { paddingBottom: Spacing.twelve },
  previewTitle: { fontSize: Typography.title },
  previewList: { flex: 1, minHeight: 0, overflow: 'hidden' },
  previewItem: { borderTopWidth: StyleSheet.hairlineWidth, justifyContent: 'center', gap: Spacing.half },
  previewItemTitle: { fontSize: Typography.body, fontWeight: '400' },
  overflow: { borderTopWidth: StyleSheet.hairlineWidth, justifyContent: 'center' },
  title: { fontSize: Typography.row, fontWeight: '600' },
  holiday: { fontSize: Typography.caption, fontWeight: '400', marginTop: Spacing.half },
  support: { fontSize: Typography.caption, marginTop: Spacing.half },
  empty: { fontSize: Typography.caption, marginTop: Spacing.two },
  item: { minHeight: 44, flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.two },
  fuzzyRangeItem: { borderWidth: 1, borderStyle: 'dashed', borderRadius: Radii.small, paddingHorizontal: Spacing.two, marginVertical: Spacing.half },
  itemTitle: { flex: 1, fontSize: Typography.body, fontWeight: '400' },
  itemMeta: { fontSize: Typography.caption },
});
