import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type ActionCardProps = {
  title: string;
  description: string;
  icon: 'wineglass.fill' | 'shaker.fill' | 'shopping.basket.fill';
};

export default function ShakerScreen() {
  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">Shaker</ThemedText>
        <ThemedText style={styles.subtitle}>
          Jump into service mode with timers, prep reminders and a live checklist for the bar team.
        </ThemedText>
      </View>

      <ActionCard
        title="Service rounds"
        description="Start a round, track tickets and sync progress with the floor in real time."
        icon="shaker.fill"
      />
      <ActionCard
        title="Build a new recipe"
        description="Capture specs, tasting notes and garnish instructions before saving to Cocktails."
        icon="wineglass.fill"
      />
      <ActionCard
        title="Restock checklist"
        description="Create a closing checklist and share it with the team before the next shift."
        icon="shopping.basket.fill"
      />
    </ThemedView>
  );
}

function ActionCard({ title, description, icon }: ActionCardProps) {
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme ?? 'light'].tint;

  return (
    <ThemedView lightColor="rgba(10,126,164,0.07)" darkColor="rgba(255,255,255,0.06)" style={styles.card}>
      <View style={styles.iconBadge}>
        <IconSymbol name={icon} size={28} color={tint} />
      </View>
      <View style={styles.cardText}>
        <ThemedText type="subtitle" style={styles.cardTitle}>
          {title}
        </ThemedText>
        <ThemedText style={styles.cardDescription}>{description}</ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 120,
    gap: 20,
  },
  header: {
    gap: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.8,
  },
  card: {
    borderRadius: 22,
    padding: 20,
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,126,164,0.12)',
  },
  cardText: {
    flex: 1,
    gap: 6,
  },
  cardTitle: {
    letterSpacing: 0.2,
  },
  cardDescription: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.85,
  },
});
