import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Radii, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { TwoDayViewModel } from '../two-day-view-model';

export function AllDayList({ day, reduceMotion, onClose, onEditEvent }: Readonly<{
  day: TwoDayViewModel;
  reduceMotion: boolean;
  onClose(): void;
  onEditEvent?(id: string, originalOccurrenceDate?: string): void;
}>) {
  const theme = useTheme();

  return <Modal transparent statusBarTranslucent navigationBarTranslucent animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={onClose}>
    <SafeAreaView style={styles.overlay}>
      <Pressable accessible={false} onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: theme.calendarBackdrop }]} />
      <View testID="all-day-list.panel" accessibilityViewIsModal style={[styles.panel, { backgroundColor: theme.calendarOverlay }]}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>{day.dateLabel}の終日予定</Text>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}>
            <Text style={{ color: theme.calendarAccentText }}>閉じる</Text>
          </Pressable>
        </View>
        <ScrollView>
          {day.allDayItems.map((item) => {
            const content = <>
              <Text style={{ color: item.kind === 'holiday' ? theme.calendarHoliday : theme.text,
                fontWeight: item.kind !== 'holiday' ? '700' : '400' }}>{item.title}</Text>
              <Text style={{ color: theme.textSecondary }}>{item.temporalLabel}</Text>
            </>;
            const style = [styles.item, { borderColor: theme.calendarBorder }];
            const eventId = item.eventId;
            return item.isInteractive && eventId !== null ? <Pressable key={item.id} style={style}
              accessibilityRole="button" accessibilityLabel={item.accessibilityLabel}
              onPress={() => {
                onClose();
                if (item.originalOccurrenceDate === undefined) onEditEvent?.(eventId);
                else onEditEvent?.(eventId, item.originalOccurrenceDate);
              }}>{content}</Pressable>
              : <View key={item.id} style={style} accessible accessibilityRole="text" accessibilityLabel={item.accessibilityLabel}>{content}</View>;
          })}
        </ScrollView>
      </View>
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: Spacing.four },
  panel: { alignSelf: 'center', width: '100%', maxWidth: 480, maxHeight: '80%', borderRadius: Radii.large, paddingHorizontal: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center' },
  heading: { flex: 1, fontSize: Typography.row, fontWeight: '600' },
  close: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  item: { minHeight: 44, paddingVertical: Spacing.two, justifyContent: 'center', borderTopWidth: StyleSheet.hairlineWidth },
});
