import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { palette } from '@theme/colors';
import { radius, spacing } from '@theme/spacing';

const shakerTips = [
  { id: '1', title: 'Select cocktails', description: 'Pick cocktails to shake based on available ingredients.' },
  { id: '2', title: 'Add to shaker', description: 'Combine ingredients virtually to create a shopping list or plan.' },
  { id: '3', title: 'Preview results', description: 'See which cocktails can be completed with current inventory.' },
];

export const ShakerScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Shaker</Text>
      <Text style={styles.subtitle}>Plan sessions, discover combinations and keep track of what you can mix.</Text>
      <FlatList
        data={shakerTips}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardDescription}>{item.description}</Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: palette.background,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: palette.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: palette.muted,
    marginBottom: spacing.lg,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: palette.border,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: palette.text,
    marginBottom: spacing.xs,
  },
  cardDescription: {
    fontSize: 14,
    color: palette.muted,
    lineHeight: 20,
  },
  separator: {
    height: spacing.md,
  },
});
