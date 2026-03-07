import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { View } from 'react-native';

import IngredientsIcon from '@/assets/images/ingredients.svg';

export type CocktailSortOption =
  | 'alphabetical'
  | 'requiredCount'
  | 'missingRequiredCount'
  | 'rating'
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
      key: 'requiredCount',
      label: '',
      selected: selectedSortOption === 'requiredCount',
      onPress: () => onSortOptionChange('requiredCount'),
      accessibilityLabel: getAccessibilityLabel('requiredCount'),
      icon: (
        <View style={styles.sortIconInnerWrap}>
          <Image
            source={IngredientsIcon}
            style={{ width: 16, height: 16, tintColor: selectedSortOption === 'requiredCount' ? surfaceColor : tintColor }}
            contentFit="contain"
          />
          {selectedSortOption === 'requiredCount' ? (
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
      key: 'missingRequiredCount',
      label: '',
      selected: selectedSortOption === 'missingRequiredCount',
      onPress: () => onSortOptionChange('missingRequiredCount'),
      accessibilityLabel: getAccessibilityLabel('missingRequiredCount'),
      icon: (
        <View style={styles.sortIconInnerWrap}>
          <MaterialCommunityIcons
            name="check"
            size={16}
            color={selectedSortOption === 'missingRequiredCount' ? surfaceColor : tintColor}
          />
          {selectedSortOption === 'missingRequiredCount' ? (
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

