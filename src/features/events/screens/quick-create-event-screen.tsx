import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { TemporalDefinitionPicker } from '../components/temporal-definition-picker';
import type { QuickCreateEventState } from '../hooks/use-quick-create-event';

type QuickCreateEventScreenProps = Readonly<{
  state: QuickCreateEventState;
  onSave(): void;
  onCancel(): void;
}>;

export function QuickCreateEventScreen({ state, onSave, onCancel }: QuickCreateEventScreenProps) {
  const theme = useTheme();
  const cannotSave =
    state.status !== 'ready' || state.isSaving || state.definitions.length === 0;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoidingView}
      >
      <View style={[styles.header, { borderBottomColor: theme.calendarBorder }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="キャンセル"
          accessibilityState={{ disabled: state.isSaving }}
          disabled={state.isSaving}
          onPress={onCancel}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
        >
          <Text
            style={[
              styles.headerButtonText,
              { color: state.isSaving ? theme.textSecondary : theme.calendarAccent },
            ]}
          >
            キャンセル
          </Text>
        </Pressable>
        <Text accessibilityRole="header" style={[styles.headerTitle, { color: theme.text }]}>
          予定を追加
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={state.isSaving ? '保存中' : '保存'}
          accessibilityState={{ disabled: cannotSave }}
          disabled={cannotSave}
          onPress={onSave}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
        >
          <Text
            style={[
              styles.headerButtonText,
              { color: cannotSave ? theme.textSecondary : theme.calendarAccent },
            ]}
          >
            {state.isSaving ? '保存中' : '保存'}
          </Text>
        </Pressable>
      </View>

      {state.status === 'loading' ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator accessibilityLabel="時間帯を読み込んでいます" />
        </View>
      ) : state.status === 'error' ? (
        <View style={styles.stateContainer}>
          <Text style={[styles.stateText, { color: theme.text }]}>時間帯を読み込めませんでした</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="再試行"
            onPress={state.retry}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
          >
            <Text style={[styles.headerButtonText, { color: theme.calendarAccent }]}>再試行</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.form}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.label, { color: theme.text }]}>タイトル</Text>
          <TextInput
            accessibilityLabel="タイトル"
            autoFocus
            editable={!state.isSaving}
            maxLength={200}
            onChangeText={state.setTitle}
            placeholder="予定のタイトル"
            placeholderTextColor={theme.textSecondary}
            returnKeyType="done"
            style={[
              styles.input,
              { borderColor: theme.calendarBorder, color: theme.text },
            ]}
            value={state.title}
          />
          {state.titleError !== null ? (
            <Text accessibilityLiveRegion="polite" style={[styles.error, { color: theme.calendarHoliday }]}>
              {state.titleError}
            </Text>
          ) : null}

          <Text style={[styles.label, styles.fieldSpacing, { color: theme.text }]}>日付</Text>
          <TextInput
            accessibilityLabel="日付"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!state.isSaving}
            inputMode="numeric"
            maxLength={10}
            onChangeText={state.setAnchorDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.input,
              { borderColor: theme.calendarBorder, color: theme.text },
            ]}
            value={state.anchorDate}
          />
          {state.anchorDateError !== null ? (
            <Text accessibilityLiveRegion="polite" style={[styles.error, { color: theme.calendarHoliday }]}>
              {state.anchorDateError}
            </Text>
          ) : null}

          <Text style={[styles.label, styles.fieldSpacing, { color: theme.text }]}>時間帯</Text>
          <TemporalDefinitionPicker
            definitions={state.definitions}
            selectedId={state.selectedDefinitionId}
            disabled={state.isSaving}
            onSelect={state.selectDefinition}
          />
          {state.saveError !== null ? (
            <Text accessibilityLiveRegion="polite" style={[styles.saveError, { color: theme.calendarHoliday }]}>
              {state.saveError}
            </Text>
          ) : null}
        </ScrollView>
      )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  keyboardAvoidingView: { flex: 1 },
  header: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: Platform.OS === 'ios' ? 12 : 8,
  },
  headerButton: { justifyContent: 'center', minHeight: 44, minWidth: 80, paddingHorizontal: 8 },
  headerButtonText: { fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  pressed: { opacity: 0.6 },
  stateContainer: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 },
  stateText: { fontSize: 16 },
  retryButton: { justifyContent: 'center', marginTop: 8, minHeight: 44, paddingHorizontal: 16 },
  form: { padding: 16, paddingBottom: 48 },
  label: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  fieldSpacing: { marginTop: 24 },
  input: { borderRadius: 8, borderWidth: 1, fontSize: 17, minHeight: 48, paddingHorizontal: 12 },
  error: { fontSize: 13, marginTop: 6 },
  saveError: { fontSize: 14, fontWeight: '600', marginTop: 24 },
});
