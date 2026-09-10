import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AgendaItemViewModel } from '../month-view-model';
import { useTheme } from '@/hooks/use-theme';

export type SelectedDayAgendaProps = Readonly<{
  selectedDate: string;
  holidayName: string | null;
  holidaySupport: 'available' | 'unsupported';
  items: readonly AgendaItemViewModel[];
  onEditEvent?(id: string): void;
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
          <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.accessibilityLabel} onPress={() => onEditEvent?.(item.id)} style={styles.item}>
            <Text style={[styles.itemTitle, { color: theme.text }]}>{item.title}</Text>
            <Text style={[styles.itemMeta, { color: theme.textSecondary }]}>{item.temporalLabel}</Text>
          </Pressable>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 17, fontWeight: '700' },
  holiday: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  support: { fontSize: 14, marginTop: 4 },
  empty: { fontSize: 15, marginTop: 12 },
  item: { minHeight: 44, flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  itemTitle: { flex: 1, fontSize: 16, fontWeight: '600' },
  itemMeta: { fontSize: 14 },
});
