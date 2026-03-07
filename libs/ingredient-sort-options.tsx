import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { View } from 'react-native';

import ShakerIcon from '@/assets/images/shaker.svg';

export type IngredientSortOption =
  | 'alphabetical'
  | 'unlocksMostCocktails'
  | 'mostUsed'
  | 'recentlyAdded';

type BuildIngredientSortOptionsParams = {
  selectedSortOption: IngredientSortOption;
  isSortDescending: boolean;
  onSortOptionChange: (option: IngredientSortOption) => void;
  tintColor: string;
  surfaceColor: string;
  getAccessibilityLabel: (option: IngredientSortOption) => string;
};

function SortDirectionIcon({ isSortDescending, color }: { isSortDescending: boolean; color: string }) {
  return (
    <MaterialCommunityIcons
      name={isSortDescending ? 'arrow-down-thin' : 'arrow-up-thin'}
      size={12}
      color={color}
      style={styles.sortDirectionIcon}
    />
  );
}

export function buildIngredientSortOptions({
  selectedSortOption,
  isSortDescending,
  onSortOptionChange,
  tintColor,
  surfaceColor,
  getAccessibilityLabel,
}: BuildIngredientSortOptionsParams) {
  const getIconColor = (option: IngredientSortOption) =>
    selectedSortOption === option ? surfaceColor : tintColor;

  return [
    {
      key: 'alphabetical',
      label: isSortDescending && selectedSortOption === 'alphabetical' ? 'z-A' : 'A-z',
      selected: selectedSortOption === 'alphabetical',
      onPress: () => onSortOptionChange('alphabetical'),
      accessibilityLabel: getAccessibilityLabel('alphabetical'),
    },
    {
      key: 'unlocksMostCocktails',
      label: '',
      selected: selectedSortOption === 'unlocksMostCocktails',
      onPress: () => onSortOptionChange('unlocksMostCocktails'),
      accessibilityLabel: getAccessibilityLabel('unlocksMostCocktails'),
      icon: (
        <View style={styles.sortIconInnerWrap}>
          <MaterialCommunityIcons
            name="glass-cocktail"
            size={16}
            color={getIconColor('unlocksMostCocktails')}
          />
          {selectedSortOption === 'unlocksMostCocktails' ? (
            <SortDirectionIcon isSortDescending={isSortDescending} color={surfaceColor} />
          ) : null}
        </View>
      ),
    },
    {
      key: 'mostUsed',
      label: '',
      selected: selectedSortOption === 'mostUsed',
      onPress: () => onSortOptionChange('mostUsed'),
      accessibilityLabel: getAccessibilityLabel('mostUsed'),
      icon: (
        <View style={styles.sortIconInnerWrap}>
          <Image
            source={ShakerIcon}
            style={{ width: 16, height: 16, tintColor: getIconColor('mostUsed') }}
            contentFit="contain"
          />
          {selectedSortOption === 'mostUsed' ? (
            <SortDirectionIcon isSortDescending={isSortDescending} color={surfaceColor} />
          ) : null}
        </View>
      ),
    },
    {
      key: 'recentlyAdded',
      label: '',
      selected: selectedSortOption === 'recentlyAdded',
      onPress: () => onSortOptionChange('recentlyAdded'),
      accessibilityLabel: getAccessibilityLabel('recentlyAdded'),
      icon: (
        <View style={styles.sortIconInnerWrap}>
          <MaterialCommunityIcons
            name="clock-outline"
            size={16}
            color={getIconColor('recentlyAdded')}
          />
          {selectedSortOption === 'recentlyAdded' ? (
            <SortDirectionIcon isSortDescending={isSortDescending} color={surfaceColor} />
          ) : null}
        </View>
      ),
    },
  ];
}

const styles = {
  sortIconInnerWrap: {
    width: 16,
    height: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  sortDirectionIcon: {
    position: 'absolute' as const,
    right: -8,
    top: -8,
  },
};
