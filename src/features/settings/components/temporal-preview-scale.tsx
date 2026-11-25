import { Spacing, Typography } from '@/constants/theme';
import { SymbolView } from 'expo-symbols';
import { eachDayOfInterval, getISODay, parseISO } from 'date-fns';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { formatClock, WEEKDAYS } from '../temporal-preferences-model';

export type ClockField = 'startMinute' | 'endMinute';
type ClockTick = Readonly<{ minute: number; position: number; label: boolean; field?: ClockField }>;

export function formatPreviewClock(minute: number): string {
  return `${minute >= 1440 ? '翌日' : ''}${formatClock(minute % 1440)}`;
}

export function getClockTicks(start: number, end: number, height: number): readonly ClockTick[] {
  const duration = end - start;
  // 近接した中間ラベルは省略しても、時刻線と編集用の両端は残す。
  const step = duration <= 180 ? 60 : Math.max(2, Math.ceil(duration * 30 / (height * 60))) * 60;
  const interior: ClockTick[] = [];
  for (let minute = (Math.floor(start / 60) + 1) * 60; minute < end; minute += 60) {
    const position = (minute - start) / duration;
    const label = (minute - Math.floor(start / 60) * 60) % step === 0 &&
      Math.min(position, 1 - position) * height >= 28;
    interior.push({ minute, position, label });
  }
  return [
    { minute: start, position: 0, label: true, field: 'startMinute' },
    ...interior,
    { minute: end, position: 1, label: true, field: 'endMinute' },
  ];
}

export function getDayTicks(start: string, end: string, width: number) {
  const dates = eachDayOfInterval({ start: parseISO(start), end: parseISO(end) });
  const monthly = dates.length > 7;
  const labelStep = Math.max(1, Math.ceil((monthly ? 42 : 24) * dates.length / width));

  return dates.map((date, index) => {
    const weekday = WEEKDAYS[getISODay(date) - 1];
    const label = monthly ? `${date.getDate()}(${weekday[0]})` : weekday[0];
    const last = dates.length - 1;
    return {
      index,
      boundary: index / dates.length,
      center: (index + 0.5) / dates.length,
      label,
      name: monthly ? `${date.getDate()}日 ${weekday}` : weekday,
      showLabel: index === 0 || index === last || (index % labelStep === 0 && last - index >= labelStep),
    };
  });
}

export function PreviewClockLabels({ ticks, onEdit }: Readonly<{
  ticks: ReturnType<typeof getClockTicks>;
  onEdit?(field: ClockField): void;
}>) {
  const theme = useTheme();
  return (
    <View style={styles.clockLabels}>
      {ticks.filter((tick) => tick.label).map((tick) => {
        const time = formatPreviewClock(tick.minute);
        const field = tick.field;
        const title = field === 'startMinute' ? '開始時刻' : '終了時刻';
        const placement = { top: `${tick.position * 100}%` as const };
        return field && onEdit ? (
          <Pressable key={field} accessibilityRole="button" accessibilityLabel={`${title}、${time}`}
            onPress={() => onEdit(field)} style={[styles.clockLabel, placement]}>
            {({ pressed }) => <View style={[styles.editable, {
              opacity: pressed ? 0.82 : 1,
            }]}>
              <Text style={[styles.label, { color: theme.calendarAccentText }]}>{time}</Text>
              <SymbolView accessible={false} name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={10} tintColor={theme.calendarAccent} />
            </View>}
          </Pressable>
        ) : (
          <View key={field ?? tick.minute} style={[styles.clockLabel, placement]} pointerEvents="none">
            <Text style={[styles.label, { color: theme.textSecondary }]}>{time}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function PreviewDayLabels({ days }: Readonly<{ days: ReturnType<typeof getDayTicks> }>) {
  const theme = useTheme();
  return (
    <View style={styles.dayLabels}>
      {days.filter((day) => day.showLabel).map((day) => (
        <Text key={day.index} accessibilityLabel={day.name}
          style={[styles.dayLabel, { left: `${day.center * 100}%`, color: theme.textSecondary }]}>
          {day.label}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  clockLabels: { width: 108 },
  clockLabel: {
    position: 'absolute', right: 6, minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end',
    transform: [{ translateY: -22 }],
  },
  editable: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.one, paddingHorizontal: Spacing.one,
  },
  label: { fontSize: Typography.caption, paddingRight: Spacing.one, fontVariant: ['tabular-nums'] },
  dayLabels: { height: 26, marginTop: Spacing.two },
  dayLabel: { position: 'absolute', width: 42, textAlign: 'center', transform: [{ translateX: -21 }], fontSize: Typography.caption },
});
