import type { CocktailTabKey, IngredientTabKey } from '@/libs/collection-tabs';
import type { Cocktail } from '@/providers/inventory-provider';

import type { OnboardingStep } from './onboarding-types';

type OnboardingStepDependencies = {
  navigateToIngredients: () => void;
  focusTab: (tab: IngredientTabKey) => void;
  scrollToIngredient: (name: string, tab: IngredientTabKey) => void;
  openIngredientDetails: (name: string) => void;
  ensureIngredientId: (name: string) => number | undefined;
  setIngredientAvailability: (id: number, available: boolean) => void;
  setIngredientShopping: (id: number, isShopping: boolean) => void;
  navigateToCocktails: () => void;
  focusCocktailTab: (tab: CocktailTabKey) => void;
  scrollToCocktail: (name: string, tab: CocktailTabKey) => void;
  openCocktailDetails: (name: string) => void;
  findCocktailByName: (name: string) => Cocktail | undefined;
  setCocktailRating: (cocktail: Cocktail, rating: number) => void;
  navigateToShaker: () => void;
  resetShakerFilters: () => void;
  ensureShakerIngredientVisible: (name: string) => void;
  selectShakerIngredient: (name: string) => void;
  showShakerResults: () => void;
};

const CHAMPAGNE = 'Champagne';
const PEACH = 'Peach';
const ORANGE_JUICE = 'Orange Juice';
const BELLINI = 'Bellini';
const WHISKEY = 'Whiskey';
const WHITE_RUM = 'White Rum';
const COLA = 'Cola';

export function createOnboardingSteps(deps: OnboardingStepDependencies): OnboardingStep[] {
  return [
    {
      id: 'ingredients-all',
      title: 'Mark ingredients in stock',
      text: 'Tap the in-stock toggle to track what you have.',
      targetId: 'ingredientRow:Champagne toggle',
      routeTo: () => {
        deps.navigateToIngredients();
      },
      onEnter: () => {
        deps.focusTab('all');
        deps.scrollToIngredient(CHAMPAGNE, 'all');
      },
      onNext: () => {
        const champagneId = deps.ensureIngredientId(CHAMPAGNE);
        const peachId = deps.ensureIngredientId(PEACH);
        deps.ensureIngredientId(ORANGE_JUICE);

        if (champagneId != null) {
          deps.setIngredientAvailability(champagneId, true);
        }

        if (peachId != null) {
          deps.setIngredientAvailability(peachId, true);
        }
      },
    },
    {
      id: 'ingredients-my',
      title: 'Add to shopping list',
      text: 'Use this button to add items you need to your shopping list.',
      targetId: 'ingredientDetails:addToShopping',
      routeTo: () => {
        deps.navigateToIngredients();
      },
      onEnter: () => {
        deps.focusTab('my');
        deps.openIngredientDetails(ORANGE_JUICE);
      },
      onNext: () => {
        const orangeJuiceId = deps.ensureIngredientId(ORANGE_JUICE);
        if (orangeJuiceId != null) {
          deps.setIngredientShopping(orangeJuiceId, true);
        }
      },
    },
    {
      id: 'ingredients-shopping',
      title: 'Remove from shopping list',
      text: 'Remove items once they are in your cart.',
      targetId: 'shoppingRow:OrangeJuice remove button',
      routeTo: () => {
        deps.navigateToIngredients();
      },
      onEnter: () => {
        deps.focusTab('shopping');
        deps.scrollToIngredient(ORANGE_JUICE, 'shopping');
      },
      onNext: () => {
        const orangeJuiceId = deps.ensureIngredientId(ORANGE_JUICE);
        if (orangeJuiceId != null) {
          deps.setIngredientShopping(orangeJuiceId, false);
        }
      },
    },
    {
      id: 'cocktails-all',
      title: 'Explore cocktails',
      text: 'Tap a cocktail to see the full recipe and details.',
      targetId: 'cocktailRow:Bellini',
      routeTo: () => {
        deps.navigateToCocktails();
      },
      onEnter: () => {
        deps.focusCocktailTab('all');
        deps.scrollToCocktail(BELLINI, 'all');
      },
      onNext: () => {
        deps.openCocktailDetails(BELLINI);
      },
    },
    {
      id: 'cocktails-my',
      title: 'Stock missing ingredients',
      text: 'Add missing ingredients straight to your shopping list.',
      targetId: 'myCocktails:addOrangeJuiceToShopping',
      routeTo: () => {
        deps.navigateToCocktails();
      },
      onEnter: () => {
        deps.focusCocktailTab('my');
        deps.scrollToCocktail(ORANGE_JUICE, 'my');
      },
      onNext: () => {
        const orangeJuiceId = deps.ensureIngredientId(ORANGE_JUICE);
        if (orangeJuiceId != null) {
          deps.setIngredientShopping(orangeJuiceId, true);
        }
      },
    },
    {
      id: 'cocktails-my-rating',
      title: 'Rate Bellini',
      text: 'Use the stars to rate cocktails you love.',
      targetId: 'cocktailDetails:ratingStars',
      routeTo: () => {
        deps.navigateToCocktails();
      },
      onEnter: () => {
        deps.focusCocktailTab('my');
        deps.openCocktailDetails(BELLINI);
      },
      onNext: () => {
        const bellini = deps.findCocktailByName(BELLINI);
        if (bellini) {
          deps.setCocktailRating(bellini, 3);
        }
      },
    },
    {
      id: 'cocktails-favorites',
      title: 'Favorites list',
      text: 'Rated cocktails appear in Favorites for quick access.',
      targetId: 'cocktailRow:Bellini',
      routeTo: () => {
        deps.navigateToCocktails();
      },
      onEnter: () => {
        deps.focusCocktailTab('favorites');
        deps.scrollToCocktail(BELLINI, 'favorites');
      },
      onNext: () => {
        const bellini = deps.findCocktailByName(BELLINI);
        if (bellini) {
          deps.setCocktailRating(bellini, 4);
          deps.openCocktailDetails(BELLINI);
        }
      },
    },
    {
      id: 'shaker-intro',
      title: 'Filters in Shaker',
      text: 'Within a single tag we use AND (all selected ingredients must match). Across different tags we use OR.',
      targetId: 'shaker:filterArea',
      routeTo: () => {
        deps.navigateToShaker();
      },
      onEnter: () => {
        deps.resetShakerFilters();
      },
      onNext: () => {
        deps.ensureShakerIngredientVisible(WHISKEY);
      },
    },
    {
      id: 'shaker-whiskey',
      title: 'Choose Whiskey',
      text: 'Select Whiskey to narrow down the results.',
      targetId: 'shaker:ingredientOption:Whiskey',
      routeTo: () => {
        deps.navigateToShaker();
      },
      onEnter: () => {
        deps.ensureShakerIngredientVisible(WHISKEY);
      },
      onNext: () => {
        deps.selectShakerIngredient(WHISKEY);
      },
    },
    {
      id: 'shaker-white-rum',
      title: 'Add White Rum',
      text: 'Add White Rum as another ingredient filter.',
      targetId: 'shaker:ingredientOption:WhiteRum',
      routeTo: () => {
        deps.navigateToShaker();
      },
      onEnter: () => {
        deps.ensureShakerIngredientVisible(WHITE_RUM);
      },
      onNext: () => {
        deps.selectShakerIngredient(WHITE_RUM);
      },
    },
    {
      id: 'shaker-cola',
      title: 'Add Cola',
      text: 'Add Cola to finish the selection.',
      targetId: 'shaker:ingredientOption:Cola',
      routeTo: () => {
        deps.navigateToShaker();
      },
      onEnter: () => {
        deps.ensureShakerIngredientVisible(COLA);
      },
      onNext: () => {
        deps.selectShakerIngredient(COLA);
      },
    },
    {
      id: 'shaker-show',
      title: 'Show results',
      text: 'Tap Show to see matching recipes.',
      targetId: 'shaker:showButton',
      routeTo: () => {
        deps.navigateToShaker();
      },
      onEnter: () => {
        deps.ensureShakerIngredientVisible(COLA);
      },
      onNext: () => {
        deps.showShakerResults();
      },
    },
  ];
}
