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
    if (reduceMotion) {
      previousTab.current = tab;
      translateX.stopAnimation();
      opacity.stopAnimation();
      translateX.setValue(0);
      opacity.setValue(1);
      return;
    }
    if (previousTab.current === tab) return;
    previousTab.current = tab;
    translateX.stopAnimation();
    opacity.stopAnimation();
    translateX.setValue(tab === 'exact' ? -12 : 12);
    opacity.setValue(0.82);
    Animated.timing(translateX, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
    Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
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
