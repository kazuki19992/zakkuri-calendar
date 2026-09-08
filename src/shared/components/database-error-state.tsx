import { Pressable, StyleSheet, Text, View } from 'react-native';

export type DatabaseErrorStateProps = Readonly<{ onRetry: () => void }>;

export function DatabaseErrorState({ onRetry }: DatabaseErrorStateProps) {
  return (
    <View style={styles.container} accessibilityRole="alert">
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  title: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  description: { fontSize: 14, textAlign: 'center' },
  button: { minHeight: 44, minWidth: 96, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
});
