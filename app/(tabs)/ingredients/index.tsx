import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/screen';
import { SearchBar } from '@/components/forms/search-bar';
import { AppHeader } from '@/components/navigation/app-header';
import { SlidingTabs } from '@/components/navigation/sliding-tabs';
import { FloatingActionButton } from '@/components/ui/fab';
import { IngredientList, IngredientListItem } from '@/features/ingredients/screens/ingredient-list';

const allIngredients: IngredientListItem[] = [
  {
    id: '7up',
    name: '7-Up',
    cocktailCount: 4,
    accentColor: '#DCFCE7',
    statusColor: '#4ADE80',
    tags: [
      { label: 'soft alcohol', color: '#38BDF8' },
      { label: 'citrus', color: '#FB923C' },
    ],
  },
  {
    id: 'absolut-citron',
    name: 'Absolut Citron',
    cocktailCount: 15,
    accentColor: '#FDE68A',
    statusColor: '#F59E0B',
    selected: true,
    tags: [
      { label: 'vodka', color: '#60A5FA' },
      { label: 'citrus', color: '#F97316' },
    ],
  },
  {
    id: 'agave-syrup',
    name: 'Agave Syrup',
    cocktailCount: 6,
    accentColor: '#FBCFE8',
    statusColor: '#EC4899',
    tags: [
      { label: 'sweetener', color: '#A855F7' },
      { label: 'syrup', color: '#F87171' },
    ],
  },
  {
    id: 'aged-rum',
    name: 'Aged Rum',
    cocktailCount: 12,
    accentColor: '#FECACA',
    statusColor: '#F97316',
    tags: [
      { label: 'strong alcohol', color: '#EF4444' },
      { label: 'rum', color: '#FBBF24' },
    ],
  },
  {
    id: 'allspice',
    name: 'Allspice',
    cocktailCount: 2,
    accentColor: '#DDD6FE',
    statusColor: '#8B5CF6',
    tags: [
      { label: 'spice', color: '#6366F1' },
    ],
  },
];

const myIngredients: IngredientListItem[] = [
  {
    id: 'aperol',
    name: 'Aperol',
    cocktailCount: 9,
    accentColor: '#FED7AA',
    statusColor: '#FB923C',
    selected: true,
    tags: [
      { label: 'bitter', color: '#F97316' },
      { label: 'soft alcohol', color: '#38BDF8' },
    ],
  },
  {
    id: 'amaro',
    name: 'Amaro Nonino',
    cocktailCount: 5,
    accentColor: '#FCD34D',
    statusColor: '#F59E0B',
    tags: [
      { label: 'herb', color: '#34D399' },
      { label: 'bitter', color: '#F97316' },
    ],
  },
  {
    id: 'angostura',
    name: 'Angostura Bitters',
    cocktailCount: 18,
    accentColor: '#FECACA',
    statusColor: '#EF4444',
    tags: [
      { label: 'bitters', color: '#F43F5E' },
      { label: 'spice', color: '#6366F1' },
    ],
  },
];

const shoppingIngredients: IngredientListItem[] = [
  {
    id: 'maraschino',
    name: 'Maraschino Liqueur',
    cocktailCount: 7,
    accentColor: '#E0E7FF',
    statusColor: '#6366F1',
    selected: true,
    detail: 'Add to shopping list',
    tags: [
      { label: 'liqueur', color: '#818CF8' },
    ],
  },
  {
    id: 'mezcal',
    name: 'Mezcal',
    cocktailCount: 11,
    accentColor: '#F3F4F6',
    statusColor: '#4B5563',
    tags: [
      { label: 'agave', color: '#34D399' },
      { label: 'smoky', color: '#9CA3AF' },
    ],
  },
  {
    id: 'mint',
    name: 'Fresh Mint',
    cocktailCount: 8,
    accentColor: '#BBF7D0',
    statusColor: '#22C55E',
    tags: [
      { label: 'herb', color: '#22C55E' },
      { label: 'fresh', color: '#4ADE80' },
    ],
  },
];

const tabs = [
  { key: 'all', title: 'All', data: allIngredients },
  { key: 'my', title: 'My', data: myIngredients },
  { key: 'shopping', title: 'Shopping', data: shoppingIngredients },
];

export default function IngredientsScreen() {
  return (
    <Screen>
      <View style={styles.container}>
        <AppHeader title="Ingredients" />
        <View style={styles.searchWrapper}>
          <SearchBar placeholder="Search ingredients" />
        </View>
        <SlidingTabs
          tabs={tabs.map((tab) => ({
            key: tab.key,
            title: tab.title,
            render: () => <IngredientList data={tab.data} showSelection />,
          }))}
        />
        <FloatingActionButton style={styles.fab} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 16,
  },
  searchWrapper: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 40,
  },
});
