import type { ReactNode } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';

export type SingleSelectOption<T extends string | number> = Readonly<{
  value: T;
  label: string;
  group?: string;
  accessory?: ReactNode;
  accessibilityLabel?: string;
}>;

type SingleSelectSheetProps<T extends string | number> = Readonly<{
  visible: boolean;
  title: string;
  value: T;
  options: readonly SingleSelectOption<T>[];
  disabled?: boolean;
  onSelect(value: T): void;
  onClose(): void;
}>;

type SheetItem<T extends string | number> =
  | Readonly<{ kind: 'group'; label: string; key: string }>
  | Readonly<{ kind: 'option'; option: SingleSelectOption<T>; key: string }>;

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

  return (
    <Modal testID="single-select-sheet.modal" transparent visible={visible}
      animationType={reduceMotion ? 'none' : 'slide'}
      statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: theme.calendarBackdrop }]}>
        <Pressable testID="single-select-sheet.backdrop" onPress={onClose}
          style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={[styles.sheet, {
          backgroundColor: theme.background,
          borderColor: theme.calendarBorder,
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
                option.group,
                selected ? '選択中' : undefined,
              ].filter(Boolean).join('、');
              return (
                <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel}
                  accessibilityState={{ disabled, selected }} disabled={disabled}
                  onPress={() => { onSelect(option.value); onClose(); }}
                  style={[styles.option, { borderBottomColor: theme.calendarBorder }]}>
                  {option.accessory}
                  <Text style={[styles.optionLabel, { color: theme.text }]}>{option.label}</Text>
                  <Text accessibilityElementsHidden importantForAccessibility="no"
                    style={[styles.check, { color: theme.calendarAccent }]}>{selected ? '✓' : ''}</Text>
                </Pressable>
              );
            }} />
          <Pressable accessibilityRole="button" accessibilityLabel="キャンセル" onPress={onClose}
            style={[styles.cancel, { borderTopColor: theme.calendarBorder }]}>
            <Text style={{ color: theme.calendarAccent }}>キャンセル</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    maxHeight: '78%',
    overflow: 'hidden',
  },
  header: { borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 18, paddingVertical: 16 },
  title: { fontSize: 18, fontWeight: '600' },
  group: { fontSize: 13, paddingBottom: 6, paddingHorizontal: 18, paddingTop: 16 },
  option: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 18,
  },
  optionLabel: { flex: 1, fontSize: 16 },
  check: { fontSize: 17, fontWeight: '700', minWidth: 22, textAlign: 'center' },
  empty: { fontSize: 15, paddingHorizontal: 18, paddingVertical: 24, textAlign: 'center' },
  cancel: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 52,
  },
});
