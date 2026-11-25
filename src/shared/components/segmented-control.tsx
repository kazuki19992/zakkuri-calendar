import { Radii, Spacing, Typography } from '@/constants/theme';
import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

export function SegmentedControl<Value extends string>({
  options, value, label, role = 'button', disabled = false, animateSelection = false, onSelect,
}: Readonly<{
  options: readonly Readonly<{ value: Value; label: string; accessibilityLabel?: string }>[];
  value: Value | null;
  label: string;
  role?: 'button' | 'tab';
  disabled?: boolean;
  animateSelection?: boolean;
  onSelect(value: Value): void;
}>) {
  const theme = useTheme();
  const selectedIndex = options.findIndex((option) => option.value === value);
  const [highlightPosition] = useState(() => new Animated.Value(Math.max(0, selectedIndex)));
  const optionWidth = 100 / Math.max(1, options.length);
  useEffect(() => {
    if (!animateSelection || selectedIndex < 0) {
      highlightPosition.setValue(Math.max(0, selectedIndex));
      return;
    }
    const animation = Animated.timing(highlightPosition, {
      toValue: selectedIndex, duration: 180, easing: Easing.out(Easing.cubic),
      useNativeDriver: false, isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [animateSelection, highlightPosition, selectedIndex]);
  const showMovingHighlight = animateSelection && selectedIndex >= 0 && options.length > 1;

  return (
    <View accessibilityRole={role === 'tab' ? 'tablist' : undefined} accessibilityLabel={label}
      style={[styles.group, { backgroundColor: theme.backgroundElement }]}>
      {showMovingHighlight ? (
        <View pointerEvents="none" style={styles.highlightTrack}>
          <Animated.View style={[styles.movingHighlight, {
            width: `${optionWidth}%`,
            left: highlightPosition.interpolate({
              inputRange: [0, options.length - 1],
              outputRange: ['0%', `${optionWidth * (options.length - 1)}%`],
            }),
            backgroundColor: theme.backgroundSelected,
          }]} />
        </View>
      ) : null}
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable key={option.value} accessibilityRole={role}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityState={{ selected, disabled }} disabled={disabled}
            {...(Platform.OS === 'web' && role === 'button' ? { 'aria-pressed': selected } : {})}
            onPress={() => onSelect(option.value)}
            style={({ pressed }) => [styles.option, {
              backgroundColor: pressed || (selected && !showMovingHighlight) ? theme.backgroundSelected : 'transparent',
            }]}>
            <Text numberOfLines={1} adjustsFontSizeToFit
              style={[styles.label, selected && styles.selected, { color: disabled ? theme.textDisabled : selected ? theme.calendarAccentText : theme.text }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', padding: Spacing.half, borderRadius: Radii.large },
  highlightTrack: { position: 'absolute', top: 2, right: 2, bottom: 2, left: 2 },
  movingHighlight: { position: 'absolute', top: 0, bottom: 0, borderRadius: Radii.small },
  option: { flex: 1, minHeight: 44, borderRadius: Radii.small, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.one },
  label: { fontSize: Typography.body, fontWeight: '400' },
  selected: { fontWeight: '600' },
});
