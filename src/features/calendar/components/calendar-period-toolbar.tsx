import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

export type CalendarPeriodToolbarProps = Readonly<{
  periodLabel: string;
  previousAccessibilityLabel: string;
  nextAccessibilityLabel: string;
  isLoading: boolean;
  onPrevious(): void;
  onToday(): void;
  onNext(): void;
}>;

export function CalendarPeriodToolbar(props: CalendarPeriodToolbarProps) {
  const theme = useTheme();
  const buttonStyle = ({ pressed }: { pressed: boolean }) => [
    styles.button,
    pressed && styles.pressed,
  ];
  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" accessibilityLabel={props.previousAccessibilityLabel}
        accessibilityState={{ disabled: props.isLoading }} disabled={props.isLoading}
        onPress={props.onPrevious} style={buttonStyle}>
        <Text style={[styles.arrow, { color: theme.calendarAccent }]}>‹</Text>
      </Pressable>
      <View style={styles.center}>
        <Text accessibilityRole="header" style={[styles.period, { color: theme.text }]}>{props.periodLabel}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="今日" accessibilityState={{ disabled: props.isLoading }}
          disabled={props.isLoading} onPress={props.onToday} style={({ pressed }) => [styles.today, pressed && styles.pressed]}>
          <Text style={[styles.todayLabel, { color: theme.calendarAccent }]}>今日</Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={props.nextAccessibilityLabel}
        accessibilityState={{ disabled: props.isLoading }} disabled={props.isLoading}
        onPress={props.onNext} style={buttonStyle}>
        {props.isLoading ? (
          <ActivityIndicator testID="calendar-period.loading" color={theme.calendarAccent} />
        ) : (
          <Text style={[styles.arrow, { color: theme.calendarAccent }]}>›</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  button: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  arrow: { fontSize: 30, lineHeight: 34 },
  center: { flex: 1, alignItems: 'center' },
  period: { fontSize: 17, fontWeight: '700' },
  today: { minHeight: 44, minWidth: 52, alignItems: 'center', justifyContent: 'center' },
  todayLabel: { fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.6 },
});
