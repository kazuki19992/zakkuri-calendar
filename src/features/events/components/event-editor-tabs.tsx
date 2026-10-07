import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { EventEditorTab } from '@/domain/calendar/event';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';

export function EventEditorTabs({ value, disabled, onChange }: Readonly<{
  value: EventEditorTab;
  disabled: boolean;
  onChange(value: EventEditorTab): void;
}>) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(value === 'fuzzy' ? 0 : 1));
  const [segmentWidth, setSegmentWidth] = useState(0);

  useEffect(() => {
    progress.stopAnimation();
    Animated.timing(progress, {
      toValue: value === 'fuzzy' ? 0 : 1,
      duration: reduceMotion ? 0 : 180,
      useNativeDriver: true,
    }).start();
  }, [progress, reduceMotion, value]);

  return (
    <View accessibilityRole="tablist" onLayout={(event) => {
      setSegmentWidth(Math.max(0, (event.nativeEvent.layout.width - 6) / 2));
    }} style={[styles.container, { backgroundColor: theme.backgroundElement }]}>
      <Animated.View pointerEvents="none" testID="event-editor.tab-indicator"
        style={[styles.indicator, {
          backgroundColor: theme.backgroundSelected,
          width: segmentWidth,
          transform: [{ translateX: progress.interpolate({
            inputRange: [0, 1], outputRange: [0, segmentWidth],
          }) }],
        }]} />
      {([['fuzzy', 'ざっくり'], ['exact', 'きっちり']] as const).map(([tab, label]) => {
        const selected = value === tab;
        return (
          <Pressable key={tab} accessibilityRole="tab" accessibilityLabel={label}
            accessibilityState={{ disabled, selected }} disabled={disabled}
            onPress={() => onChange(tab)} style={styles.tab}>
            <Text style={[styles.label, {
              color: selected ? theme.calendarAccent : theme.textSecondary,
            }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 9, flexDirection: 'row', padding: 3, position: 'relative' },
  indicator: { borderRadius: 7, bottom: 3, left: 3, position: 'absolute', top: 3 },
  tab: { alignItems: 'center', borderRadius: 7, flex: 1, justifyContent: 'center', minHeight: 44 },
  label: { fontSize: 15, fontWeight: '600' },
});
