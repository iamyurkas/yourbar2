import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CollectionHeader } from '@/components/CollectionHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { palette } from '@/theme/theme';

type ActionCardProps = {
  title: string;
  description: string;
  icon: 'wineglass.fill' | 'shaker.fill' | 'shopping.basket.fill';
};

export default function ShakerScreen() {
  const [query, setQuery] = useState('');
  const paletteColors = Colors;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: paletteColors.background }]}
      edges={['top', 'left', 'right']}>
      <ThemedView style={[styles.screen, { backgroundColor: paletteColors.background }]}>
        <CollectionHeader searchValue={query} onSearchChange={setQuery} placeholder="Search" />
        <View style={styles.container}>
          <View style={styles.header}>
            <ThemedText type="title">Shaker</ThemedText>
            <ThemedText style={[styles.subtitle, { color: paletteColors.onSurfaceVariant }]}>
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
        </View>
      </ThemedView>
    </SafeAreaView>
  );
}

function ActionCard({ title, description, icon }: ActionCardProps) {
  const paletteColors = Colors;
  const tint = paletteColors.tint;
  const backgroundColor = palette.surfaceBright;
  const borderColor = paletteColors.outlineVariant;

  return (
    <ThemedView
      style={[
        styles.card,
        {
          backgroundColor,
          borderColor,
          shadowColor: palette.shadow,
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        },
      ]}>
      <View style={[styles.iconBadge, { backgroundColor: `${tint}1F`, borderColor: `${tint}33` }]}>
        <IconSymbol name={icon} size={28} color={tint} />
      </View>
      <View style={styles.cardText}>
        <ThemedText type="subtitle" style={styles.cardTitle}>
          {title}
        </ThemedText>
        <ThemedText style={[styles.cardDescription, { color: paletteColors.onSurfaceVariant }]}>
          {description}
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 120,
    gap: 20,
  },
  header: {
    gap: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardText: {
    flex: 1,
    gap: 6,
  },
  cardTitle: {
    letterSpacing: 0.2,
    fontSize: 18,
    fontWeight: '600',
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 22,
  },
});
