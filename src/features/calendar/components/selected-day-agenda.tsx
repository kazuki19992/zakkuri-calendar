import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AgendaItemViewModel } from '../month-view-model';
import { useTheme } from '@/hooks/use-theme';

export type SelectedDayAgendaProps = Readonly<{
  selectedDate: string;
  holidayName: string | null;
  holidaySupport: 'available' | 'unsupported';
  items: readonly AgendaItemViewModel[];
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
}: SelectedDayAgendaProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { borderTopColor: theme.calendarBorder }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
        {formatSelectedDate(selectedDate)}の予定
      </Text>
      {holidayName !== null ? (
        <Text style={[styles.holiday, { color: theme.calendarHoliday }]}>{holidayName}</Text>
      ) : holidaySupport === 'unsupported' ? (
        <Text style={[styles.support, { color: theme.textSecondary }]}>祝日情報未対応</Text>
      ) : null}
      {items.length === 0 ? (
        <Text style={[styles.empty, { color: theme.textSecondary }]}>予定はありません</Text>
      ) : (
        items.map((item) => (
          <Pressable
            key={item.id}
            testID={item.kind === 'fuzzyRange' ? `selected-day-agenda.fuzzy-range.${item.id}` : undefined}
            accessibilityRole="button"
            accessibilityLabel={item.accessibilityLabel}
            onPress={() => item.originalOccurrenceDate === undefined
              ? onEditEvent?.(item.eventId)
              : onEditEvent?.(item.eventId, item.originalOccurrenceDate)}
            style={[
              styles.item,
              item.kind === 'fuzzyRange' && { borderColor: theme.calendarAccent },
              item.kind === 'fuzzyRange' && styles.fuzzyRangeItem,
            ]}
          >
            <Text style={[styles.itemTitle, { color: theme.text }]}>{item.title}</Text>
            <Text style={[styles.itemMeta, { color: theme.textSecondary }]}>{item.temporalLabel}</Text>
          </Pressable>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 8 },
  title: { fontSize: 15, fontWeight: '600' },
  holiday: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  support: { fontSize: 12, marginTop: 2 },
  empty: { fontSize: 13, marginTop: 8 },
  item: { minHeight: 44, flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  fuzzyRangeItem: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 4, paddingHorizontal: 6, marginVertical: 2 },
  itemTitle: { flex: 1, fontSize: 14, fontWeight: '500' },
  itemMeta: { fontSize: 12 },
});
