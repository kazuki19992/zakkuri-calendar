import { Radii, Spacing } from '@/constants/theme';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

export function CalendarSaveNotice() {
  const theme = useTheme();
  return (
    <View pointerEvents="none" style={styles.position}>
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite"
        style={[styles.label, { color: theme.calendarEventText, backgroundColor: theme.calendarAccentText }]}>
        予定を保存しました
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  position: { position: 'absolute', left: 12, right: 12, bottom: '15%', alignItems: 'center', zIndex: 12 },
  label: { borderRadius: Radii.large, paddingVertical: Spacing.twelve, paddingHorizontal: Spacing.three, overflow: 'hidden', fontWeight: '600' },
});
