import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View } from 'react-native';

export type CocktailSortOption =
  | 'alphabetical'
  | 'party'
  | 'rating'
  | 'recentlyAdded'
  | 'random';

type BuildCocktailSortOptionsParams = {
  selectedSortOption: CocktailSortOption;
  isSortDescending: boolean;
  onSortOptionChange: (option: CocktailSortOption) => void;
  tintColor: string;
  surfaceColor: string;
  getAccessibilityLabel: (option: CocktailSortOption) => string;
};

export function buildCocktailSortOptions({
  selectedSortOption,
  isSortDescending,
  onSortOptionChange,
  tintColor,
  surfaceColor,
  getAccessibilityLabel,
}: BuildCocktailSortOptionsParams) {
  return [
    {
      key: 'alphabetical',
      label: isSortDescending && selectedSortOption === 'alphabetical' ? 'z-A' : 'A-z',
      selected: selectedSortOption === 'alphabetical',
      onPress: () => onSortOptionChange('alphabetical'),
      accessibilityLabel: getAccessibilityLabel('alphabetical'),
    },
    {
      key: 'party',
      label: '',
      selected: selectedSortOption === 'party',
      onPress: () => onSortOptionChange('party'),
      accessibilityLabel: getAccessibilityLabel('party'),
      icon: (
        <View style={styles.sortIconInnerWrap}>
          <MaterialCommunityIcons
            name="party-popper"
            size={16}
            color={selectedSortOption === 'party' ? surfaceColor : tintColor}
          />
          {selectedSortOption === 'party' ? (
            <MaterialCommunityIcons
              name={isSortDescending ? 'arrow-down-thin' : 'arrow-up-thin'}
              size={12}
              color={surfaceColor}
              style={styles.sortDirectionIcon}
            />
          ) : null}
        </View>
      ),
    },
    {
      key: 'rating',
      label: '',
      selected: selectedSortOption === 'rating',
      onPress: () => onSortOptionChange('rating'),
      accessibilityLabel: getAccessibilityLabel('rating'),
      icon: (
        <View style={styles.sortIconInnerWrap}>
          <MaterialCommunityIcons
            name="star"
            size={16}
            color={selectedSortOption === 'rating' ? surfaceColor : tintColor}
          />
          {selectedSortOption === 'rating' ? (
            <MaterialCommunityIcons
              name={isSortDescending ? 'arrow-down-thin' : 'arrow-up-thin'}
              size={12}
              color={surfaceColor}
              style={styles.sortDirectionIcon}
            />
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
            color={selectedSortOption === 'recentlyAdded' ? surfaceColor : tintColor}
          />
          {selectedSortOption === 'recentlyAdded' ? (
            <MaterialCommunityIcons
              name={isSortDescending ? 'arrow-down-thin' : 'arrow-up-thin'}
              size={12}
              color={surfaceColor}
              style={styles.sortDirectionIcon}
            />
          ) : null}
        </View>
      ),
    },
    {
      key: 'random',
      label: '',
      selected: selectedSortOption === 'random',
      onPress: () => onSortOptionChange('random'),
      accessibilityLabel: getAccessibilityLabel('random'),
      icon: (
        <View style={styles.sortIconInnerWrap}>
          <MaterialCommunityIcons
            name="shuffle-variant"
            size={16}
            color={selectedSortOption === 'random' ? surfaceColor : tintColor}
          />
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
