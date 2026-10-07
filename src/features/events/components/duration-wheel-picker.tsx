import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';

const ITEM_HEIGHT = 44;

type DurationWheelPickerProps = Readonly<{
  visible: boolean;
  initialMinutes: number;
  maxHours: number;
  onConfirm(totalMinutes: number): void;
  onClose(): void;
}>;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getInitialSelection(initialMinutes: number, maxHours: number) {
  const totalMinutes = clamp(Math.round(initialMinutes), 0, maxHours * 60 + 59);
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

function selectionLabel(hours: number, minutes: number): string {
  return hours === 0 && minutes === 0 ? '予定時刻' : `${hours}時間${minutes}分前`;
}

export function DurationWheelPicker({
  maxHours,
  ...props
}: DurationWheelPickerProps) {
  const safeMaxHours = Math.max(0, Math.floor(maxHours));
  return (
    <DurationWheelPickerContent key={`${props.visible}-${props.initialMinutes}-${safeMaxHours}`}
      {...props} maxHours={safeMaxHours} />
  );
}

function DurationWheelPickerContent({
  visible,
  initialMinutes,
  maxHours,
  onConfirm,
  onClose,
}: DurationWheelPickerProps) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const safeMaxHours = maxHours;
  const initialSelection = getInitialSelection(initialMinutes, safeMaxHours);
  const [hours, setHours] = useState(initialSelection.hours);
  const [minutes, setMinutes] = useState(initialSelection.minutes);
  const hourOptions = useMemo(
    () => Array.from({ length: safeMaxHours + 1 }, (_, value) => value),
    [safeMaxHours],
  );
  const minuteOptions = useMemo(() => Array.from({ length: 60 }, (_, value) => value), []);

  const updateSelectionFromScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
    maximum: number,
    setValue: (value: number) => void,
  ) => {
    const index = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    setValue(clamp(index, 0, maximum));
  };

  const renderWheel = (
    kind: 'hours' | 'minutes',
    data: readonly number[],
    selected: number,
    setSelected: (value: number) => void,
  ) => (
    <View style={styles.wheelColumn}>
      <ScrollView key={`${kind}-${initialMinutes}-${safeMaxHours}-${visible}`}
        testID={`duration-wheel.${kind}`}
        snapToInterval={ITEM_HEIGHT} decelerationRate="fast" showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.wheelContent}
        contentOffset={{ x: 0, y: selected * ITEM_HEIGHT }}
        onScrollEndDrag={(event) => updateSelectionFromScroll(
          event,
          data.length - 1,
          setSelected,
        )}
        onMomentumScrollEnd={(event) => updateSelectionFromScroll(
          event,
          data.length - 1,
          setSelected,
        )}>
        {data.map((item) => (
          <Pressable testID={`duration-wheel.${kind}-option-${item}`}
            key={item}
            accessibilityRole="button"
            accessibilityLabel={`${item}${kind === 'hours' ? '時間' : '分'}`}
            accessibilityState={{ selected: item === selected }}
            onPress={() => setSelected(item)} style={styles.wheelItem}>
            <Text style={[styles.wheelValue, {
              color: item === selected ? theme.calendarAccent : theme.textSecondary,
              fontWeight: item === selected ? '700' : '400',
            }]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text pointerEvents="none" style={[styles.unit, { color: theme.text }]}>
        {kind === 'hours' ? '時間' : '分'}
      </Text>
    </View>
  );

  return (
    <Modal testID="duration-wheel.modal" transparent visible={visible}
      animationType={reduceMotion ? 'none' : 'slide'} statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: theme.calendarBackdrop }]}>
        <Pressable testID="duration-wheel.backdrop" accessible={false}
          importantForAccessibility="no" focusable={false} onPress={onClose}
          style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={[styles.sheet, {
          backgroundColor: theme.background,
          borderColor: theme.calendarBorder,
        }]}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>通知時間</Text>
          <View accessible accessibilityLabel={`通知時間、${selectionLabel(hours, minutes)}`}
            style={styles.summary}>
            <Text style={[styles.summaryText, { color: theme.text }]}>{selectionLabel(hours, minutes)}</Text>
          </View>
          <View style={styles.wheels}>
            {renderWheel('hours', hourOptions, hours, setHours)}
            {renderWheel('minutes', minuteOptions, minutes, setMinutes)}
          </View>
          <View style={[styles.actions, { borderTopColor: theme.calendarBorder }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="キャンセル" onPress={onClose}
              style={styles.action}>
              <Text style={{ color: theme.textSecondary }}>キャンセル</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="通知時間を確定"
              onPress={() => { onConfirm(hours * 60 + minutes); onClose(); }} style={styles.action}>
              <Text style={{ color: theme.calendarAccent, fontWeight: '600' }}>確定</Text>
            </Pressable>
          </View>
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
    paddingTop: 16,
  },
  title: { fontSize: 18, fontWeight: '600', paddingHorizontal: 18 },
  summary: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  summaryText: { fontSize: 15 },
  wheels: { alignSelf: 'center', flexDirection: 'row', height: 220, width: 280 },
  wheelColumn: { flex: 1, flexDirection: 'row' },
  wheelContent: { paddingVertical: 88 },
  wheelItem: { alignItems: 'center', height: ITEM_HEIGHT, justifyContent: 'center', minWidth: 76 },
  wheelValue: { fontSize: 20 },
  unit: { alignSelf: 'center', fontSize: 15, marginRight: 10 },
  actions: { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row' },
  action: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: 52 },
});
