import { ScrollView, StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const cocktails = [
  {
    name: 'Negroni',
    description: 'Equal parts gin, Campari, and sweet vermouth stirred over ice with an orange twist.',
  },
  {
    name: 'Whisky Sour',
    description: 'A silky blend of bourbon, lemon, and a hint of syrup shaken hard and crowned with foam.',
  },
  {
    name: 'Margarita',
    description: 'Tequila, lime, and orange liqueur served on the rocks with a salted rim.',
  },
];

export default function CocktailsScreen() {
  return (
    <ThemedView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedView
          style={styles.hero}
          lightColor={Colors.light.surfaceVariant}
          darkColor={Colors.dark.surfaceVariant}>
          <ThemedText type="subtitle">Tonight&apos;s Selection</ThemedText>
          <ThemedText type="title" style={styles.heroTitle}>
            Signature Cocktails
          </ThemedText>
          <ThemedText style={styles.heroDescription}>
            Curated classics and modern favorites, balanced for every palette.
          </ThemedText>
        </ThemedView>

        <View style={styles.list}>
          {cocktails.map((cocktail) => (
            <ThemedView
              key={cocktail.name}
              style={styles.card}
              lightColor={Colors.light.background}
              darkColor={Colors.dark.surface}>
              <ThemedText type="subtitle" style={styles.cardTitle}>
                {cocktail.name}
              </ThemedText>
              <ThemedText>{cocktail.description}</ThemedText>
            </ThemedView>
          ))}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    gap: 24,
  },
  hero: {
    borderRadius: 24,
    padding: 24,
    gap: 12,
  },
  heroTitle: {
    marginBottom: 4,
  },
  heroDescription: {
    opacity: 0.8,
  },
  list: {
    gap: 16,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 18,
  },
});
