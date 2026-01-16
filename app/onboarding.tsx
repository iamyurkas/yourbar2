import { Stack, useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useOnboarding } from '@/providers/onboarding-provider';

export default function OnboardingScreen() {
  const { finishOnboarding } = useOnboarding();
  const router = useRouter();

  const handleClose = () => {
    finishOnboarding();
    router.replace('/');
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Onboarding' }} />
      <ThemedText type="title" style={styles.title}>
        Onboarding restarted
      </ThemedText>
      <ThemedText style={styles.body}>
        You can now follow the guided steps again from the start.
      </ThemedText>
      <Pressable accessibilityRole="button" onPress={handleClose} style={styles.button}>
        <ThemedText style={styles.buttonLabel}>Return to the app</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
    color: Colors.onSurfaceVariant,
  },
  button: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: Colors.tint,
  },
  buttonLabel: {
    color: Colors.background,
  },
});
