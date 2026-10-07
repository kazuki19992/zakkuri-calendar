import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated } from 'react-native';
import type { EventEditorTab } from '@/domain/calendar/event';
import { useReduceMotion } from '@/hooks/use-reduce-motion';

export function EventEditorTabContent({ tab, children }: Readonly<{
  tab: EventEditorTab;
  children: ReactNode;
}>) {
  const reduceMotion = useReduceMotion();
  const previousTab = useRef(tab);
  const [translateX] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (previousTab.current === tab) return;
    previousTab.current = tab;
    translateX.stopAnimation();
    opacity.stopAnimation();
    translateX.setValue(reduceMotion ? 0 : tab === 'exact' ? -12 : 12);
    opacity.setValue(reduceMotion ? 1 : 0.82);
    const duration = reduceMotion ? 0 : 180;
    Animated.timing(translateX, {
      toValue: 0,
      duration,
      useNativeDriver: true,
    }).start();
    Animated.timing(opacity, {
      toValue: 1,
      duration,
      useNativeDriver: true,
    }).start();
  }, [opacity, reduceMotion, tab, translateX]);

  return (
    <Animated.View testID="event-editor.tab-content"
      style={{ opacity, transform: [{ translateX }] }}>
      {children}
    </Animated.View>
  );
}
