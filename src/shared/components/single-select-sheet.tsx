import { Radii, Spacing, Typography } from '@/constants/theme';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';

export type SingleSelectOption<T extends string | number> = Readonly<{
  value: T;
  label: string;
  description?: string;
  group?: string;
  accessory?: ReactNode;
  accessibilityLabel?: string;
}>;

type SingleSelectSheetProps<T extends string | number> = Readonly<{
  visible: boolean;
  title: string;
  value: T | null;
  options: readonly SingleSelectOption<T>[];
  disabled?: boolean;
  onSelect(value: T): void;
  onClose(): void;
}>;

type SheetItem<T extends string | number> =
  | Readonly<{ kind: 'group'; label: string; key: string }>
  | Readonly<{ kind: 'option'; option: SingleSelectOption<T>; key: string }>;

const AnimatedSafeAreaView = Animated.createAnimatedComponent(SafeAreaView);
const ANIMATION_DURATION_MS = 180;
const SHEET_OFFSET = 16;

function buildSheetItems<T extends string | number>(
  options: readonly SingleSelectOption<T>[],
): readonly SheetItem<T>[] {
  const items: SheetItem<T>[] = [];
  let currentGroup: string | undefined;

  options.forEach((option, index) => {
    if (option.group !== undefined && option.group !== currentGroup) {
      items.push({ kind: 'group', label: option.group, key: `group-${index}-${option.group}` });
    }
    currentGroup = option.group;
    items.push({ kind: 'option', option, key: `option-${index}-${String(option.value)}` });
  });

  return items;
}

export function SingleSelectSheet<T extends string | number>({
  visible,
  title,
  value,
  options,
  disabled = false,
  onSelect,
  onClose,
}: SingleSelectSheetProps<T>) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const items = buildSheetItems(options);
  const [backdropOpacity] = useState(
    () => new Animated.Value(visible && reduceMotion ? 1 : 0),
  );
  const [sheetTranslateY] = useState(
    () => new Animated.Value(visible && reduceMotion ? 0 : SHEET_OFFSET),
  );
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const closeNotifiedRef = useRef(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const notifyClose = useCallback(() => {
    if (closeNotifiedRef.current) return;
    closeNotifiedRef.current = true;
    setClosing(false);
    onCloseRef.current();
  }, []);

  useEffect(() => {
    if (!visible) {
      const wasClosing = closingRef.current;
      closingRef.current = false;
      closeNotifiedRef.current = false;
      if (wasClosing) setClosing(false);
      return;
    }
    if (closingRef.current) {
      backdropOpacity.stopAnimation();
      sheetTranslateY.stopAnimation();
      if (reduceMotion) notifyClose();
      return;
    }
    closeNotifiedRef.current = false;
    backdropOpacity.stopAnimation();
    sheetTranslateY.stopAnimation();
    if (reduceMotion) {
      backdropOpacity.setValue(1);
      sheetTranslateY.setValue(0);
      return;
    }
    backdropOpacity.setValue(0);
    sheetTranslateY.setValue(SHEET_OFFSET);
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: ANIMATION_DURATION_MS,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: 0,
        duration: ANIMATION_DURATION_MS,
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, notifyClose, reduceMotion, sheetTranslateY, visible]);

  const startClose = (beforeClose?: () => void) => {
    if (closingRef.current) return;
    closingRef.current = true;
    closeNotifiedRef.current = false;
    setClosing(true);
    beforeClose?.();
    backdropOpacity.stopAnimation();
    sheetTranslateY.stopAnimation();
    if (reduceMotion) {
      notifyClose();
      return;
    }
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: ANIMATION_DURATION_MS,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: SHEET_OFFSET,
        duration: ANIMATION_DURATION_MS,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) notifyClose();
    });
  };

  const requestClose = () => startClose();

  return (
    <Modal testID="single-select-sheet.modal" transparent visible={visible}
      animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={requestClose}>
      <SafeAreaView edges={['top']} style={styles.overlay}>
        <Animated.View testID="single-select-sheet.backdrop-shade" pointerEvents="none"
          style={[StyleSheet.absoluteFill, {
            backgroundColor: theme.calendarBackdrop,
            opacity: reduceMotion ? 1 : backdropOpacity,
          }]} />
        <Pressable testID="single-select-sheet.backdrop" accessible={false} disabled={closing}
          importantForAccessibility="no" focusable={false} onPress={requestClose}
          style={StyleSheet.absoluteFill} />
        <AnimatedSafeAreaView testID="single-select-sheet.sheet" accessibilityViewIsModal edges={['left', 'bottom', 'right']}
          style={[styles.sheet, {
          backgroundColor: theme.background,
          borderColor: theme.calendarBorder,
          transform: [{ translateY: reduceMotion ? 0 : sheetTranslateY }],
        }]}>
          <View style={[styles.header, { borderBottomColor: theme.calendarBorder }]}>
            <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{title}</Text>
          </View>
          <FlatList data={items} keyExtractor={(item) => item.key}
            ListEmptyComponent={<Text style={[styles.empty, { color: theme.textSecondary }]}>選択肢がありません</Text>}
            renderItem={({ item }) => {
              if (item.kind === 'group') {
                return (
                  <Text accessible={false} importantForAccessibility="no"
                    style={[styles.group, { color: theme.textSecondary }]}>{item.label}</Text>
                );
              }

              const { option } = item;
              const selected = option.value === value;
              const accessibilityLabel = [
                option.accessibilityLabel ?? option.label,
                option.description,
                option.group,
                selected ? '選択中' : undefined,
              ].filter(Boolean).join('、');
              return (
                <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel}
                  accessibilityState={{ disabled: disabled || closing, selected }}
                  disabled={disabled || closing}
                  onPress={() => startClose(() => onSelect(option.value))}
                  style={[styles.option, { borderBottomColor: theme.calendarBorder }]}>
                  {option.accessory}
                  <View style={styles.optionText}>
                    <Text style={[styles.optionLabel, { color: theme.text }]}>{option.label}</Text>
                    {option.description ? (
                      <Text style={[styles.optionDescription, { color: theme.textSecondary }]}>{option.description}</Text>
                    ) : null}
                  </View>
                  <Text accessibilityElementsHidden importantForAccessibility="no"
                    style={[styles.check, { color: theme.calendarAccentText }]}>{selected ? '✓' : ''}</Text>
                </Pressable>
              );
            }} />
          <Pressable accessibilityRole="button" accessibilityLabel="キャンセル"
            accessibilityState={{ disabled: closing }} disabled={closing} onPress={requestClose}
            style={[styles.cancel, { borderTopColor: theme.calendarBorder }]}>
            <Text style={{ color: theme.calendarAccentText }}>キャンセル</Text>
          </Pressable>
        </AnimatedSafeAreaView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', paddingTop: Spacing.four },
  sheet: {
    borderTopLeftRadius: Radii.large,
    borderTopRightRadius: Radii.large,
    borderTopWidth: StyleSheet.hairlineWidth,
    maxHeight: '78%',
    overflow: 'hidden',
  },
  header: { borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three },
  title: { fontSize: Typography.title, fontWeight: '600' },
  group: { fontSize: Typography.caption, paddingBottom: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  option: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: Spacing.twelve,
    minHeight: 52,
    paddingHorizontal: Spacing.three,
  },
  optionText: { flex: 1, gap: Spacing.one, paddingVertical: Spacing.two },
  optionLabel: { fontSize: Typography.row },
  optionDescription: { fontSize: Typography.caption },
  check: { fontSize: Typography.row, fontWeight: '700', minWidth: 22, textAlign: 'center' },
  empty: { fontSize: Typography.row, paddingHorizontal: Spacing.three, paddingVertical: Spacing.four, textAlign: 'center' },
  cancel: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 52,
  },
});
