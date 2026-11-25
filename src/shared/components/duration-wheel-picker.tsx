import { Radii, Spacing, Typography } from '@/constants/theme';
import { useMemo, useRef, useState, type ComponentRef } from 'react';
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
  const [total, setTotal] = useState(() => clamp(
    Math.round(initialMinutes / minuteStep) * minuteStep, 0, maxHours * 60 + 60 - minuteStep,
  ));
  const valid = total >= minimumMinutes && total <= maximumMinutes;
  const valueLabel = formatValue ? formatValue(total) : selectionLabel(Math.floor(total / 60), total % 60);

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
            <HoursAndMinutesWheels value={total} maxHours={maxHours} minuteStep={minuteStep} hourUnit={hourUnit}
              onChange={setTotal} />
          </ScrollView>
          <View style={[styles.actions, { borderTopColor: theme.calendarBorder }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="キャンセル" onPress={onClose}
              style={styles.action}>
              <Text style={{ color: theme.textSecondary }}>キャンセル</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`${title}を確定`} disabled={!valid} accessibilityState={{ disabled: !valid }}
              onPress={() => { onConfirm(total); onClose(); }} style={styles.action}>
              <Text style={{ color: theme.calendarAccentText, fontWeight: '600' }}>確定</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </SafeAreaView>
    </Modal>
  );
}

export function HoursAndMinutesWheels({
  value,
  maxHours,
  minuteStep,
  hourUnit,
  testID,
  onChange,
}: Readonly<{
  value: number;
  maxHours: number;
  minuteStep: 1 | 15;
  hourUnit: '時間' | '時';
  testID?: string;
  onChange(value: number): void;
}>) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  const [initialMinute] = useState(minutes);
  const hourOptions = useMemo(() => Array.from({ length: maxHours + 1 }, (_, hour) => hour), [maxHours]);
  const minuteOptions = useMemo(() => {
    const steps = Array.from({ length: 60 / minuteStep }, (_, index) => index * minuteStep);
    // 保存済みの時刻が15分刻みでなくても、開くだけで値を丸めない。
    if (initialMinute % minuteStep !== 0) steps.push(initialMinute);
    return steps.sort((first, second) => first - second);
  }, [initialMinute, minuteStep]);

  return (
    <View testID={testID} style={styles.wheels}>
      <WheelColumn kind="hours" unit={hourUnit} options={hourOptions} selected={hours}
        onSelect={(hour) => onChange(hour * 60 + minutes)} />
      <WheelColumn kind="minutes" unit="分" options={minuteOptions} selected={minutes}
        onSelect={(minute) => onChange(hours * 60 + minute)} />
    </View>
  );
}

function WheelColumn({ kind, unit, options, selected, onSelect }: Readonly<{
  kind: 'hours' | 'minutes';
  unit: string;
  options: readonly number[];
  selected: number;
  onSelect(value: number): void;
}>) {
  const theme = useTheme();
  const scrollView = useRef<ComponentRef<typeof ScrollView>>(null);
  const [initialOffset] = useState(() => ({ x: 0, y: options.indexOf(selected) * ITEM_HEIGHT }));

  const selectAtOffset = (offset: number) => {
    const index = clamp(Math.round(offset / ITEM_HEIGHT), 0, options.length - 1);
    if (options[index] !== selected) onSelect(options[index]);
  };

  return (
    <View style={styles.wheelColumn}>
      <ScrollView ref={scrollView} testID={`duration-wheel.${kind}`}
        nestedScrollEnabled snapToInterval={ITEM_HEIGHT} decelerationRate="fast" showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.wheelContent} contentOffset={initialOffset}
        onScrollEndDrag={({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
          selectAtOffset(nativeEvent.targetContentOffset?.y ?? nativeEvent.contentOffset.y);
        }}
        onMomentumScrollEnd={(event) => selectAtOffset(event.nativeEvent.contentOffset.y)}>
        {options.map((item, index) => (
          <Pressable key={item} testID={`duration-wheel.${kind}-option-${item}`} accessibilityRole="button"
            accessibilityLabel={`${item}${unit}`} accessibilityState={{ selected: item === selected }}
            onPress={() => {
              scrollView.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: false });
              if (item !== selected) onSelect(item);
            }} style={styles.wheelItem}>
            <Text style={[styles.wheelValue, {
              color: item === selected ? theme.calendarAccentText : theme.textSecondary,
              fontWeight: item === selected ? '700' : '400',
            }]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text pointerEvents="none" style={[styles.unit, { color: theme.text }]}>{unit}</Text>
    </View>
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
