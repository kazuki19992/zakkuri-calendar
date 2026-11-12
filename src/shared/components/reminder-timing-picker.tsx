import { useContext, useRef, useState } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
  StyleSheet,
  Text,
  View,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import {
  timingLabel,
  type ReminderTiming,
} from '@/domain/notifications/reminder-timing';
const HEIGHT = 44;
function NumberWheel({
  name,
  unit,
  max,
  value,
  onChange,
}: {
  name: string;
  unit: string;
  max: number;
  value: number;
  onChange(value: number): void;
}) {
  const theme = useTheme(),
    ref = useRef<FlatList<number>>(null);
  const [viewportHeight, setViewportHeight] = useState(220);
  const end = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    onChange(
      Math.max(
        0,
        Math.min(max, Math.round(e.nativeEvent.contentOffset.y / HEIGHT)),
      ),
    );
  const choose = (v: number) => {
    onChange(v);
    ref.current?.scrollToOffset({ offset: v * HEIGHT, animated: false });
  };
  return (
    <View
      style={styles.column}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={unit}
      accessibilityValue={{ min: 0, max, now: value, text: `${value}${unit}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) =>
        choose(
          Math.max(
            0,
            Math.min(
              max,
              value + (e.nativeEvent.actionName === 'increment' ? 1 : -1),
            ),
          ),
        )
      }
    >
      <FlatList
        ref={ref}
        testID={`notification-wheel.${name}`}
        data={Array.from({ length: max + 1 }, (_, v) => v)}
        keyExtractor={(v) => String(v)}
        getItemLayout={(_, i) => ({
          length: HEIGHT,
          offset: i * HEIGHT,
          index: i,
        })}
        initialScrollIndex={value}
        contentContainerStyle={{
          paddingVertical: Math.max(0, (viewportHeight - HEIGHT) / 2),
        }}
        onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
        snapToInterval={HEIGHT}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onScrollEndDrag={end}
        onMomentumScrollEnd={end}
        extraData={value}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item}${unit}`}
            accessibilityState={{ selected: item === value }}
            onPress={() => choose(item)}
            style={styles.item}
          >
            <Text
              style={{
                color:
                  item === value ? theme.calendarAccent : theme.textSecondary,
                fontSize: 20,
                fontWeight: item === value ? '700' : '400',
              }}
            >
              {item}
            </Text>
          </Pressable>
        )}
      />
      <Text style={{ color: theme.text, textAlign: 'center' }}>{unit}</Text>
    </View>
  );
}
export type ReminderTimingPickerProps = {
  visible: boolean;
  value: Exclude<ReminderTiming, { kind: 'legacyStartOffset' }>;
  allowEnd?: boolean;
  fixedAnchor?: boolean;
  onConfirm(value: ReminderTiming): void;
  onClose(): void;
};
/** 日数と壁時計時刻を分数へ混同せず、予定編集と設定で同じ操作を使う。 */
export function ReminderTimingPicker(props: ReminderTimingPickerProps) {
  return props.visible ? (
    <PickerContent
      key={`${props.value.kind}:${JSON.stringify(props.value)}`}
      {...props}
    />
  ) : null;
}
function PickerContent({
  value,
  allowEnd = true,
  fixedAnchor = false,
  onConfirm,
  onClose,
}: ReminderTimingPickerProps) {
  const theme = useTheme(),
    reduce = useReduceMotion();
  const { height } = useWindowDimensions();
  const insets = useContext(SafeAreaInsetsContext);
  const initial = value;
  const calendar = value.kind === 'relativeDate';
  const [anchor, setAnchor] = useState(initial.anchor);
  const mins =
    initial.kind === 'relativeDate'
      ? Number(initial.time.slice(0, 2)) * 60 + Number(initial.time.slice(3))
      : initial.minutesBefore;
  const [days, setDays] = useState(
    initial.kind === 'relativeDate'
      ? initial.daysBefore
      : Math.min(365, Math.floor(mins / 1440)),
  );
  const [hours, setHours] = useState(Math.floor((mins % 1440) / 60)),
    [minutes, setMinutes] = useState(mins % 60),
    [selecting, setSelecting] = useState(false);
  const timing: ReminderTiming = calendar
    ? {
        version: 1,
        kind: 'relativeDate',
        anchor,
        daysBefore: days,
        time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
      }
    : {
        version: 1,
        kind: 'relativeMinutes',
        anchor,
        minutesBefore: days * 1440 + hours * 60 + minutes,
      };
  return (
    <Modal
      transparent
      visible
      animationType={reduce ? 'none' : 'fade'}
      onRequestClose={onClose}
    >
      <View
        style={[styles.overlay, { backgroundColor: theme.calendarBackdrop }]}
      >
        <Pressable
          accessible={false}
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View
          testID="notification-timing.sheet"
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: theme.background,
              maxHeight: Math.max(0, height - (insets?.top ?? 0) - 16),
              paddingBottom: Math.max(32, insets?.bottom ?? 0),
              paddingLeft: Math.max(20, insets?.left ?? 0),
              paddingRight: Math.max(20, insets?.right ?? 0),
            },
          ]}
        >
          <ScrollView
            testID="notification-timing.header-scroll"
            style={styles.headerScroll}
            contentContainerStyle={{ gap: 10 }}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            <Text
              accessibilityRole="header"
              style={{ color: theme.text, fontSize: 18 }}
            >
              通知タイミング
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`通知の基準、${anchor === 'start' ? '開始' : '終了'}`}
              accessibilityState={{ disabled: fixedAnchor }}
              disabled={fixedAnchor}
              onPress={() => setSelecting((v) => !v)}
              style={styles.row}
            >
              <Text style={{ color: theme.text }}>基準</Text>
              <Text style={{ color: theme.text }}>
                {anchor === 'start' ? '開始' : '終了'}
                {calendar ? '日' : ''}
                {fixedAnchor ? '' : ' ▾'}
              </Text>
            </Pressable>
            {selecting ? (
              <View>
                {(['start', 'end'] as const)
                  .filter((v) => v === 'start' || allowEnd)
                  .map((v) => (
                    <Pressable
                      key={v}
                      accessibilityRole="button"
                      accessibilityState={{ selected: v === anchor }}
                      onPress={() => {
                        setAnchor(v);
                        setSelecting(false);
                      }}
                      style={styles.row}
                    >
                      <Text style={{ color: theme.text }}>
                        {v === 'start' ? '開始' : '終了'}
                        {calendar ? '日' : ''}
                      </Text>
                      <Text style={{ color: theme.calendarAccent }}>
                        {v === anchor ? '✓' : ' '}
                      </Text>
                    </Pressable>
                  ))}
              </View>
            ) : null}
            <Text
              accessibilityLabel={`通知タイミング、${timingLabel(timing)}`}
              style={{ color: theme.text, textAlign: 'center' }}
            >
              {timingLabel(timing)}
            </Text>
          </ScrollView>
          <View style={styles.wheels}>
            <NumberWheel
              name="days"
              unit={calendar ? '日前' : '日'}
              max={365}
              value={days}
              onChange={setDays}
            />
            <NumberWheel
              name="hours"
              unit={calendar ? '時' : '時間'}
              max={23}
              value={hours}
              onChange={setHours}
            />
            <NumberWheel
              name="minutes"
              unit="分"
              max={59}
              value={minutes}
              onChange={setMinutes}
            />
          </View>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="通知タイミングをキャンセル"
              style={styles.action}
              onPress={onClose}
            >
              <Text style={{ color: theme.text }}>キャンセル</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="通知タイミングを確定"
              style={styles.action}
              onPress={() => {
                onConfirm(timing);
                onClose();
              }}
            >
              <Text style={{ color: theme.calendarAccent }}>確定</Text>
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
    padding: 20,
    paddingBottom: 32,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    gap: 10,
  },
  headerScroll: { flexShrink: 1, minHeight: 44 },
  wheels: {
    height: 250,
    minHeight: 64,
    flexShrink: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  column: { flex: 1, maxWidth: 120 },
  item: { height: HEIGHT, alignItems: 'center', justifyContent: 'center' },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actions: { flexDirection: 'row', flexShrink: 0 },
  action: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
