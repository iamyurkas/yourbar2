import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/screen';
import { AppHeader } from '@/components/navigation/app-header';
import { ThemedText } from '@/components/themed-text';

export default function ShakerScreen() {
  return (
    <Screen>
      <View style={styles.container}>
        <AppHeader title="Shaker" />
        <View style={styles.content}>
          <ThemedText type="subtitle" style={styles.subtitle}>
            Build your next mix
          </ThemedText>
          <ThemedText style={styles.body}>
            Combine ingredients from your bar cart, track missing components, and preview steps before
            you start shaking. This screen will guide bartenders through crafting cocktails once the
            business logic is connected.
          </ThemedText>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 16,
  },
  content: {
    paddingHorizontal: 24,
    gap: 12,
  },
  subtitle: {
    fontSize: 22,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: '#6B7280',
  },
});
