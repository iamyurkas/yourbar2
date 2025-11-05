import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/screen';
import { SearchBar } from '@/components/forms/search-bar';
import { AppHeader } from '@/components/navigation/app-header';
import { SlidingTabs } from '@/components/navigation/sliding-tabs';
import { CocktailList, CocktailListItem } from '@/features/cocktails/screens/cocktail-list';

const allCocktails: CocktailListItem[] = [
  {
    id: '1910',
    name: '1910',
    missing: 'Missing: 3 ingredients',
    detail: 'Dry Sherry, Red Vermouth, Orange Bitters, Ice',
    accentColor: '#F8E3A2',
    badgeColor: '#60A5FA',
    tags: [
      { label: 'IBA Official', color: '#6366F1' },
      { label: 'New Era', color: '#A855F7' },
      { label: 'strong', color: '#EF4444' },
    ],
  },
  {
    id: '1910-favorite',
    name: '20th Century Cocktail',
    missing: 'Missing: 1 ingredient',
    detail: 'Lillet Blanc, Creme de Cacao, Lemon Juice',
    accentColor: '#FECACA',
    badgeColor: '#F87171',
    isFavorite: true,
    tags: [
      { label: 'Unforgettables', color: '#2DD4BF' },
      { label: 'moderate', color: '#FB923C' },
    ],
  },
  {
    id: 'abc',
    name: 'ABC',
    missing: 'Missing: 2 ingredients',
    detail: 'Amaretto, Baileys, Cognac',
    accentColor: '#FCD34D',
    badgeColor: '#FBBF24',
    tags: [
      { label: 'Shooter', color: '#60A5FA' },
      { label: 'sweet', color: '#F472B6' },
    ],
  },
  {
    id: 'adonis',
    name: 'Adonis',
    missing: 'Missing: 3 ingredients',
    detail: 'Dry Sherry, Red Vermouth, Orange Bitters, Ice',
    accentColor: '#BBF7D0',
    badgeColor: '#34D399',
    tags: [
      { label: 'Contemporary', color: '#38BDF8' },
      { label: 'low ABV', color: '#34D399' },
    ],
  },
  {
    id: 'alabama-slammer',
    name: 'Alabama Slammer (long)',
    missing: 'Missing: 2 ingredients',
    detail: 'Amaretto, Sloe Gin, Orange Juice, Lemon Juice',
    accentColor: '#FDBA74',
    badgeColor: '#F97316',
    tags: [
      { label: 'long', color: '#FACC15' },
      { label: 'fruit', color: '#22D3EE' },
    ],
  },
];

const myCocktails: CocktailListItem[] = [
  {
    id: 'agavoni',
    name: 'Agavoni',
    missing: 'Missing: 1 ingredient',
    detail: 'Tequila Blanco, Red Vermouth, Campari, Ice',
    accentColor: '#C4B5FD',
    badgeColor: '#A855F7',
    isFavorite: true,
    tags: [
      { label: 'bitter', color: '#F97316' },
      { label: 'IBA Official', color: '#6366F1' },
    ],
  },
  {
    id: 'ale-house',
    name: 'Ale House Punch',
    missing: 'Missing: 2 ingredients',
    detail: 'London Dry Gin, Brown Ale, Lemon Juice',
    accentColor: '#FDE68A',
    badgeColor: '#F59E0B',
    tags: [
      { label: 'punch', color: '#F59E0B' },
      { label: 'sharing', color: '#34D399' },
    ],
  },
  {
    id: 'airmail',
    name: 'Air Mail',
    missing: 'Missing: 0 ingredients',
    detail: 'Rum, Lime Juice, Honey Syrup, Champagne',
    accentColor: '#BFDBFE',
    badgeColor: '#2563EB',
    tags: [
      { label: 'sparkling', color: '#38BDF8' },
      { label: 'party', color: '#F472B6' },
    ],
  },
];

const favoriteCocktails: CocktailListItem[] = [
  {
    id: 'americano',
    name: 'Americano',
    missing: 'Missing: 1 ingredient',
    detail: 'Campari, Red Vermouth, Soda Water, Orange',
    accentColor: '#FECACA',
    badgeColor: '#F87171',
    isFavorite: true,
    tags: [
      { label: 'aperitivo', color: '#F97316' },
      { label: 'classic', color: '#6366F1' },
    ],
  },
  {
    id: 'aviation',
    name: 'Aviation',
    missing: 'Missing: 2 ingredients',
    detail: 'Gin, Maraschino Liqueur, Crème de Violette, Lemon',
    accentColor: '#DDD6FE',
    badgeColor: '#8B5CF6',
    isFavorite: true,
    tags: [
      { label: 'floral', color: '#A855F7' },
      { label: 'IBA Official', color: '#6366F1' },
    ],
  },
  {
    id: 'aperol-spritz',
    name: 'Aperol Spritz',
    missing: 'Missing: 0 ingredients',
    detail: 'Aperol, Prosecco, Soda Water, Orange',
    accentColor: '#FCD34D',
    badgeColor: '#FB923C',
    isFavorite: true,
    tags: [
      { label: 'spritz', color: '#FB923C' },
      { label: 'summer', color: '#34D399' },
    ],
  },
];

const tabs = [
  { key: 'all', title: 'All', data: allCocktails },
  { key: 'my', title: 'My', data: myCocktails },
  { key: 'favorites', title: 'Favorites', data: favoriteCocktails },
];

export default function CocktailsScreen() {
  return (
    <Screen>
      <View style={styles.container}>
        <AppHeader title="Cocktails" />
        <View style={styles.searchWrapper}>
          <SearchBar placeholder="Search cocktails" />
        </View>
        <SlidingTabs
          tabs={tabs.map((tab) => ({
            key: tab.key,
            title: tab.title,
            render: () => <CocktailList data={tab.data} />,
          }))}
        />
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
});
