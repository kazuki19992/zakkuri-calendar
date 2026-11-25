import { Text, View } from 'react-native';
import type { ThisWeekDeadlineWeekday } from '@/domain/temporal/relative-date-resolution';
import { useTheme } from '@/hooks/use-theme';
import { SettingsDivider, SettingsGroup, SettingsListScroll, SettingsRow, settingsListStyles } from '../components/settings-list';
import type { useTemporalPreferences } from '../hooks/use-temporal-preferences';
import { WEEKDAYS, formatTemporalRange } from '../temporal-preferences-model';

const categories = [
  { granularity: 'day', title: '1日の時間帯' },
  { granularity: 'week', title: '週の時間表現' },
  { granularity: 'month', title: '月の時間表現' },
] as const;

export function TemporalPreferencesScreen({ state, deadlineWeekday, onOpen }: Readonly<{
  state: ReturnType<typeof useTemporalPreferences>;
  deadlineWeekday?: ThisWeekDeadlineWeekday;
  onOpen(id: string): void;
}>) {
  const theme = useTheme();

  return (
    <SettingsListScroll>
      {state.status === 'loading' ? <Text style={[settingsListStyles.inset, { color: theme.text }]}>読み込み中…</Text> : null}
      {state.status === 'error' ? <>
        <Text accessibilityRole="alert" style={[settingsListStyles.inset, { color: theme.calendarHoliday }]}>
          時間表現を読み込めませんでした
        </Text>
        <SettingsRow title="再読み込み" onPress={() => { void state.reload(); }} />
      </> : null}
      {state.status === 'ready' ? categories.map(({ granularity, title }) => (
        <SettingsGroup key={granularity} title={title}
          footer={granularity === 'week' ? '初期設定では「来週後半」に週末を含みます。' : undefined}>
          {state.items.filter((item) => item.granularity === granularity).map((item, index) => {
            const value = item.resolverConfig.kind === 'weekRemainder'
              ? deadlineWeekday && `${WEEKDAYS[deadlineWeekday - 1]}まで`
              : formatTemporalRange(item);
            return (
              <View key={item.id}>
                {index > 0 ? <SettingsDivider /> : null}
                <SettingsRow title={item.label} value={value} onPress={() => onOpen(item.id)} />
              </View>
            );
          })}
        </SettingsGroup>
      )) : null}
    </SettingsListScroll>
  );
}
