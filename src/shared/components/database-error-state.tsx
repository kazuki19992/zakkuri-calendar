import { Spacing, Typography } from '@/constants/theme';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export type DatabaseErrorStateProps = Readonly<{ onRetry: () => void }>;

export function DatabaseErrorState({ onRetry }: DatabaseErrorStateProps) {
  return (
    <SafeAreaView style={styles.container} accessibilityRole="alert">
      <Text style={styles.title}>データを読み込めませんでした</Text>
      <Text style={styles.description}>時間をおいて、もう一度お試しください。</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="再試行"
        onPress={onRetry}
        style={styles.button}
      >
        <Text style={styles.buttonLabel}>再試行</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.twelve, padding: Spacing.four },
  title: { fontSize: Typography.title, fontWeight: '600', textAlign: 'center' },
  description: { fontSize: Typography.body, textAlign: 'center' },
  button: { minHeight: 44, minWidth: 96, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.three },
  buttonLabel: { fontSize: Typography.row, fontWeight: '600' },
});
