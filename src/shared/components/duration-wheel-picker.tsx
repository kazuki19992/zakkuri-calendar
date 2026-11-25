import { Radii, Spacing, Typography } from '@/constants/theme';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';

const ITEM_HEIGHT = 44;
const VISIBLE_WHEEL_ITEMS = 5;

type DurationWheelPickerProps = Readonly<{
  visible: boolean;
  initialMinutes: number;
  maxHours: number;
  title?: string;
  minuteStep?: 1 | 15;
  hourUnit?: '時間' | '時';
  minimumMinutes?: number;
  maximumMinutes?: number;
  formatValue?(minutes: number): string;
  onConfirm(totalMinutes: number): void;
  onClose(): void;
}>;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getInitialSelection(initialMinutes: number, maxHours: number, minuteStep: number) {
  const maximum = maxHours * 60 + (60 - minuteStep);
  const totalMinutes = clamp(Math.round(initialMinutes / minuteStep) * minuteStep, 0, maximum);
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
    <DurationWheelPickerContent key={`${props.visible}-${props.initialMinutes}-${safeMaxHours}-${props.minuteStep ?? 1}`}
      {...props} maxHours={safeMaxHours} />
  );
}

function DurationWheelPickerContent({
  visible,
  initialMinutes,
  maxHours,
  title = '通知時間',
  minuteStep = 1,
  hourUnit = '時間',
  minimumMinutes = 0,
  maximumMinutes = maxHours * 60 + 59,
  formatValue,
  onConfirm,
  onClose,
}: DurationWheelPickerProps) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const safeMaxHours = maxHours;
  const initialSelection = getInitialSelection(initialMinutes, safeMaxHours, minuteStep);
  const [hours, setHours] = useState(initialSelection.hours);
  const [minutes, setMinutes] = useState(initialSelection.minutes);
  const total = hours * 60 + minutes;
  const valid = total >= minimumMinutes && total <= maximumMinutes;
  const valueLabel = formatValue ? formatValue(total) : selectionLabel(hours, minutes);
  const hourOptions = useMemo(
    () => Array.from({ length: safeMaxHours + 1 }, (_, value) => value),
    [safeMaxHours],
  );
  const minuteOptions = useMemo(() => Array.from({ length: 60 / minuteStep }, (_, index) => index * minuteStep), [minuteStep]);

  const updateSelectionFromScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
    data: readonly number[],
    setValue: (value: number) => void,
  ) => {
    const index = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    setValue(data[clamp(index, 0, data.length - 1)]);
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
        nestedScrollEnabled snapToInterval={ITEM_HEIGHT} decelerationRate="fast" showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.wheelContent}
        contentOffset={{ x: 0, y: data.indexOf(selected) * ITEM_HEIGHT }}
        onScrollEndDrag={(event) => updateSelectionFromScroll(
          event,
          data,
          setSelected,
        )}
        onMomentumScrollEnd={(event) => updateSelectionFromScroll(
          event,
          data,
          setSelected,
        )}>
        {data.map((item) => (
          <Pressable testID={`duration-wheel.${kind}-option-${item}`}
            key={item}
            accessibilityRole="button"
            accessibilityLabel={`${item}${kind === 'hours' ? hourUnit : '分'}`}
            accessibilityState={{ selected: item === selected }}
            onPress={() => setSelected(item)} style={styles.wheelItem}>
            <Text style={[styles.wheelValue, {
              color: item === selected ? theme.calendarAccentText : theme.textSecondary,
              fontWeight: item === selected ? '700' : '400',
            }]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text pointerEvents="none" style={[styles.unit, { color: theme.text }]}>
        {kind === 'hours' ? hourUnit : '分'}
      </Text>
    </View>
  );

  return (
    <Modal testID="duration-wheel.modal" transparent visible={visible}
      animationType={reduceMotion ? 'none' : 'slide'} statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <SafeAreaView edges={['top']} style={[styles.overlay, { backgroundColor: theme.calendarBackdrop }]}>
        <Pressable testID="duration-wheel.backdrop" accessible={false}
          importantForAccessibility="no" focusable={false} onPress={onClose}
          style={StyleSheet.absoluteFill} />
        <SafeAreaView edges={['left', 'bottom', 'right']} accessibilityViewIsModal style={[styles.sheet, {
          backgroundColor: theme.background,
          borderColor: theme.calendarBorder,
        }]}>
          <ScrollView style={styles.body} bounces={false} nestedScrollEnabled>
            <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{title}</Text>
            <View accessible accessibilityLabel={`${title}、${valueLabel}`}
              style={styles.summary}>
              <Text style={[styles.summaryText, { color: theme.text }]}>{valueLabel}</Text>
            </View>
            <View style={styles.wheels}>
              {renderWheel('hours', hourOptions, hours, setHours)}
              {renderWheel('minutes', minuteOptions, minutes, setMinutes)}
            </View>
          </ScrollView>
          <View style={[styles.actions, { borderTopColor: theme.calendarBorder }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="キャンセル" onPress={onClose}
              style={styles.action}>
              <Text style={{ color: theme.textSecondary }}>キャンセル</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`${title}を確定`} disabled={!valid} accessibilityState={{ disabled: !valid }}
              onPress={() => { onConfirm(hours * 60 + minutes); onClose(); }} style={styles.action}>
              <Text style={{ color: theme.calendarAccentText, fontWeight: '600' }}>確定</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', paddingTop: Spacing.four },
  sheet: {
    flexShrink: 1,
    borderTopLeftRadius: Radii.small,
    borderTopRightRadius: Radii.small,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
  },
  body: { flexGrow: 0, flexShrink: 1 },
  title: { fontSize: Typography.title, fontWeight: '600', paddingHorizontal: Spacing.three },
  summary: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  summaryText: { fontSize: Typography.row },
  wheels: { alignSelf: 'center', flexDirection: 'row', height: VISIBLE_WHEEL_ITEMS * ITEM_HEIGHT, width: '100%', maxWidth: 280 },
  wheelColumn: { flex: 1, flexDirection: 'row' },
  wheelContent: { paddingVertical: (VISIBLE_WHEEL_ITEMS - 1) * ITEM_HEIGHT / 2 },
  wheelItem: { alignItems: 'center', height: ITEM_HEIGHT, justifyContent: 'center', minWidth: 76 },
  wheelValue: { fontSize: Typography.title },
  unit: { alignSelf: 'center', fontSize: Typography.row, marginRight: Spacing.twelve },
  actions: { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row' },
  action: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: 52 },
});
