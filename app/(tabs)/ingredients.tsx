import { ScrollView, StyleSheet } from 'react-native';

import { Colors } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const ingredients = [
  {
    category: 'Base Spirits',
    items: ['Gin', 'Bourbon', 'Tequila Reposado', 'Dark Rum'],
  },
  {
    category: 'Liqueurs & Modifiers',
    items: ['Campari', 'Sweet Vermouth', 'Elderflower Liqueur', 'Orange Curaçao'],
  },
  {
    category: 'Fresh Elements',
    items: ['Lime Juice', 'Lemon Juice', 'Mint', 'Expressed Orange Peel'],
  },
];

export default function IngredientsScreen() {
  return (
    <ThemedView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedView
          style={styles.header}
          lightColor={Colors.light.surfaceVariant}
          darkColor={Colors.dark.surfaceVariant}>
          <ThemedText type="title">Ingredients Pantry</ThemedText>
          <ThemedText style={styles.subtitle}>
            Keep these essentials stocked to build cocktails with confidence.
          </ThemedText>
        </ThemedView>

        {ingredients.map((section) => (
          <ThemedView
            key={section.category}
            style={styles.card}
            lightColor={Colors.light.background}
            darkColor={Colors.dark.surface}>
            <ThemedText type="subtitle" style={styles.cardTitle}>
              {section.category}
            </ThemedText>
            {section.items.map((item) => (
              <ThemedText key={item} style={styles.item}>
                • {item}
              </ThemedText>
            ))}
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
  card: {
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
  cardTitle: {
    fontSize: 18,
  },
  item: {
    fontSize: 16,
  },
});
