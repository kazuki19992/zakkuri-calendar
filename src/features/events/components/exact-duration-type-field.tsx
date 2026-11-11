import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ExactDuration } from '@/domain/calendar/event';
import { useTheme } from '@/hooks/use-theme';
import { SingleSelectSheet } from '@/shared/components/single-select-sheet';

const OPTIONS = [
  { value: 'fixed', label: '時刻を指定' },
  { value: 'instant', label: '長さなし' },
  { value: 'undetermined', label: '未定' },
] as const;
export function ExactDurationTypeField({ value, status, disabled, onChange, onRetry }: Readonly<{
  value: ExactDuration['type']; status: 'loading' | 'ready' | 'error'; disabled: boolean;
  onChange(value: ExactDuration['type']): void; onRetry(): void;
}>) {
  const theme = useTheme();
  const [selecting, setSelecting] = useState(false);
  const blocked = disabled || status !== 'ready';
  const label = OPTIONS.find((option) => option.value === value)?.label ?? '';
  return <View>
    <Pressable accessibilityRole="button" accessibilityLabel={`終了、${label}`}
      accessibilityState={{ disabled: blocked }} disabled={blocked} style={styles.row} onPress={() => setSelecting(true)}>
      <Text style={{ color: theme.textSecondary }}>終了</Text><Text style={{ color: theme.text }}>{label} ▾</Text>
    </Pressable>
    {status === 'loading' ? <Text style={{ color: theme.textSecondary }}>初期の長さを読み込み中</Text> : null}
    {status === 'error' ? <>
      <Text accessibilityRole="alert" style={{ color: theme.calendarHoliday }}>初期の長さを読み込めませんでした。</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="初期の長さを再読み込み" disabled={disabled}
        style={styles.row} onPress={onRetry}><Text style={{ color: theme.calendarAccent }}>再読み込み</Text></Pressable>
    </> : null}
    <SingleSelectSheet visible={selecting} title="終了の指定" value={value} options={OPTIONS}
      disabled={blocked} onSelect={onChange} onClose={() => setSelecting(false)} />
  </View>;
}
const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', minHeight: 52 },
});
