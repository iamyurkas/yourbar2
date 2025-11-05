import { ScrollView, StyleSheet } from 'react-native';

import { Colors } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const shakerTips = [
  {
    title: 'Chill the Tin',
    description: 'Fill the shaker with ice before building to keep every component frosty from the first pour.',
  },
  {
    title: 'Shake with Rhythm',
    description: 'Hold the shaker at a slight angle and shake in long arcs for 8–10 seconds to aerate the drink.',
  },
  {
    title: 'Double Strain',
    description: 'Use a Hawthorne and fine mesh strainer together to remove chips of ice or muddled herbs.',
  },
];

export default function ShakerScreen() {
  return (
    <ThemedView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedView
          style={styles.header}
          lightColor={Colors.light.surfaceVariant}
          darkColor={Colors.dark.surfaceVariant}>
          <ThemedText type="title">Shaker Techniques</ThemedText>
          <ThemedText style={styles.subtitle}>
            Elevate your craft with professional mixing habits and mindful motion.
          </ThemedText>
        </ThemedView>

        {shakerTips.map((tip) => (
          <ThemedView
            key={tip.title}
            style={styles.tipCard}
            lightColor={Colors.light.background}
            darkColor={Colors.dark.surface}>
            <ThemedText type="subtitle" style={styles.tipTitle}>
              {tip.title}
            </ThemedText>
            <ThemedText>{tip.description}</ThemedText>
          </ThemedView>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    padding: 24,
    gap: 20,
  },
  header: {
    borderRadius: 24,
    padding: 24,
    gap: 12,
  },
  subtitle: {
    opacity: 0.8,
  },
  tipCard: {
    borderRadius: 18,
    padding: 20,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 1,
  },
  tipTitle: {
    fontSize: 18,
  },
});
