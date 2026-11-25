import { Spacing } from '@/constants/theme';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ExactDuration } from '@/domain/calendar/event';
import { useTheme } from '@/hooks/use-theme';
import { SingleSelectSheet } from '@/shared/components/single-select-sheet';

const OPTIONS = [
  { value: 'fixed', label: '時刻を指定', description: '終了日と終了時刻を入力します。' },
  { value: 'instant', label: '長さなし', description: '開始時刻だけを記録します。' },
  { value: 'undetermined', label: '未定', description: '開始時刻は決まっていて、終了時刻は未定です。' },
] as const;
/**
 * 終了種別をラベルと選択印で区別し、初期長の取得失敗をこの入力内で再試行させる。
 * 他の入力を保持するため、フォーム全体の読込み失敗とは分けて表示する。
 */
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
      accessibilityState={{ disabled: blocked }} disabled={blocked} style={styles.row} onPress={() => { Keyboard.dismiss(); setSelecting(true); }}>
      <Text style={{ color: theme.textSecondary }}>終了</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
        <Text style={{ color: theme.text }}>{label}</Text>
        <SymbolView accessible={false} name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={12} tintColor={theme.textSecondary} />
      </View>
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
  row: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.twelve, justifyContent: 'space-between', minHeight: 52 },
});
