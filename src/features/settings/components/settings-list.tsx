import { Spacing, Typography } from '@/constants/theme';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';

export function SettingsListScroll({ children, testID }: Readonly<{ children: ReactNode; testID?: string }>) {
  const theme = useTheme();
  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.screen, { backgroundColor: theme.backgroundElement }]}>
      <ScrollView testID={testID} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={settingsListStyles.content}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function SettingsGroup({ title, footer, children }: Readonly<{ title: string; footer?: string; children?: ReactNode }>) {
  const theme = useTheme();
  return (
    <View style={styles.group}>
      <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>{title}</Text>
      {children ? <View style={{ backgroundColor: theme.background }}>
        {children}
      </View> : null}
      {footer ? <Text style={[styles.footer, { color: theme.textSecondary }]}>{footer}</Text> : null}
    </View>
  );
}

export function SettingsRow({ title, value, description, accessibilityLabel, disabled = false, onPress }: Readonly<{
  title: string;
  value?: string;
  description?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  onPress(): void;
}>) {
  const theme = useTheme();
  const foreground = disabled ? theme.textDisabled : theme.text;

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? (value ? `${title}、${value}` : title)}
      accessibilityHint={description} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.backgroundSelected : theme.background }]}>
      <View style={styles.copy}>
        <SettingsRowText title={title} description={description} color={foreground} />
      </View>
      {value ? <Text style={[styles.value, { color: foreground }]}>{value}</Text> : null}
      <SymbolView accessible={false} name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={12} tintColor={disabled ? theme.textDisabled : theme.textSecondary} />
    </Pressable>
  );
}

export function SettingsSwitchRow({ title, description, value, disabled, onValueChange }: Readonly<{
  title: string;
  description?: string;
  value: boolean;
  disabled: boolean;
  onValueChange(value: boolean): void;
}>) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.copy} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <SettingsRowText title={title} description={description} color={theme.text} />
      </View>
      <Switch accessibilityLabel={title} accessibilityHint={description} accessibilityState={{ disabled }}
        disabled={disabled} value={value} onValueChange={onValueChange}
        trackColor={{ false: theme.calendarBorder, true: theme.calendarAccent }} />
    </View>
  );
}

function SettingsRowText({ title, description, color }: Readonly<{ title: string; description?: string; color: string }>) {
  const theme = useTheme();
  return <>
    <Text style={[styles.title, { color }]}>{title}</Text>
    {description ? <Text style={[styles.note, { color: theme.textSecondary }]}>{description}</Text> : null}
  </>;
}

export function SettingsDivider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.calendarBorder }]} />;
}

export const settingsListStyles = StyleSheet.create({
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingTop: Spacing.twelve, paddingBottom: Spacing.five, gap: Spacing.five },
  inset: { paddingHorizontal: Spacing.three },
  note: { fontSize: Typography.caption, paddingHorizontal: Spacing.three, paddingTop: Spacing.one, paddingBottom: Spacing.twelve },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  group: { gap: Spacing.two },
  heading: { fontSize: Typography.row, fontWeight: '600', paddingHorizontal: Spacing.three },
  footer: { fontSize: Typography.body, paddingHorizontal: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.twelve, minHeight: 54, paddingHorizontal: Spacing.three, paddingVertical: Spacing.twelve },
  copy: { flex: 1, minWidth: 0, gap: Spacing.one },
  title: { fontSize: Typography.row },
  value: { flexShrink: 1, maxWidth: '46%', textAlign: 'right', fontSize: Typography.body },
  note: { fontSize: Typography.body },
  divider: { marginHorizontal: Spacing.three, height: StyleSheet.hairlineWidth },
});
