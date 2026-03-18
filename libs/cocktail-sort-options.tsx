import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { View } from 'react-native';

import IngredientsIcon from '@/assets/images/ingredients.svg';

export type CocktailSortOption =
  | 'alphabetical'
  | 'requiredCount'
  | 'partySelected'
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
  showRequiredCountOption?: boolean;
  showPartySelectedOption?: boolean;
};

export function buildCocktailSortOptions({
  selectedSortOption,
  isSortDescending,
  onSortOptionChange,
  tintColor,
  surfaceColor,
  getAccessibilityLabel,
  showRequiredCountOption = true,
  showPartySelectedOption = false,
}: BuildCocktailSortOptionsParams) {
  const options = [
    {
      key: 'alphabetical',
      label: isSortDescending && selectedSortOption === 'alphabetical' ? 'z-A' : 'A-z',
      selected: selectedSortOption === 'alphabetical',
      onPress: () => onSortOptionChange('alphabetical'),
      accessibilityLabel: getAccessibilityLabel('alphabetical'),
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

  if (showRequiredCountOption) {
    options.splice(1, 0, {
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
    });
  }

  if (showPartySelectedOption) {
    options.splice(showRequiredCountOption ? 2 : 1, 0, {
      key: 'partySelected',
      label: '',
      selected: selectedSortOption === 'partySelected',
      onPress: () => onSortOptionChange('partySelected'),
      accessibilityLabel: getAccessibilityLabel('partySelected'),
      icon: (
        <View style={styles.sortIconInnerWrap}>
          <MaterialCommunityIcons
            name="party-popper"
            size={16}
            color={selectedSortOption === 'partySelected' ? surfaceColor : tintColor}
          />
          {selectedSortOption === 'partySelected' ? (
            <MaterialCommunityIcons
              name={isSortDescending ? 'arrow-down-thin' : 'arrow-up-thin'}
              size={12}
              color={surfaceColor}
              style={styles.sortDirectionIcon}
            />
          ) : null}
        </View>
      ),
    });
  }

  return options;
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
