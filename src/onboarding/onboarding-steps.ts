import type { OnboardingStep } from './onboarding-types';

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to YourBar',
    text: 'Let\'s take a quick guided tour of the essentials.',
    routeTo: (router) => {
      router.navigate('/cocktails');
    },
    onNext: ({ inventory }) => {
      inventory.ensureIngredientIdByName('Champagne');
      inventory.ensureIngredientIdByName('Peach');
      inventory.ensureIngredientIdByName('Orange Juice');
    },
  },
  {
    id: 'ingredients-all',
    title: 'Track your ingredients',
    text: 'You can mark ingredients you have in stock and build your bar.',
    targetId: 'ingredientRow:Champagne',
    routeTo: (router) => {
      router.navigate('/ingredients');
    },
    onNext: ({ inventory }) => {
      const champagneId = inventory.ensureIngredientIdByName('Champagne');
      if (champagneId != null) {
        inventory.setIngredientAvailability(champagneId, true);
      }

      const peachId = inventory.ensureIngredientIdByName('Peach');
      if (peachId != null) {
        inventory.setIngredientAvailability(peachId, true);
      }
    },
  },
  {
    id: 'ingredients-my',
    title: 'Build a shopping list',
    text: 'Add ingredients to your shopping list so you can pick them up later.',
    targetId: 'ingredientDetails:addToShopping',
    routeTo: (router) => {
      router.navigate('/ingredients');
    },
    onEnter: ({ inventory, router }) => {
      const orangeJuiceId = inventory.getIngredientIdByName('Orange Juice');
      if (orangeJuiceId == null) {
        return;
      }
      router.navigate(`/ingredients/${orangeJuiceId}`);
    },
    onNext: ({ inventory }) => {
      const orangeJuiceId = inventory.ensureIngredientIdByName('Orange Juice');
      if (orangeJuiceId == null) {
        return;
      }
      if (!inventory.isIngredientOnShoppingList(orangeJuiceId)) {
        inventory.toggleIngredientShopping(orangeJuiceId);
      }
    },
  },
  {
    id: 'ingredients-shopping',
    title: 'Review your shopping list',
    text: 'Remove items once you have them in your cart or at home.',
    targetId: 'shoppingRow:OrangeJuice',
    routeTo: (router) => {
      router.navigate('/ingredients');
    },
    onNext: ({ inventory }) => {
      const orangeJuiceId = inventory.getIngredientIdByName('Orange Juice');
      if (orangeJuiceId == null) {
        return;
      }
      if (inventory.isIngredientOnShoppingList(orangeJuiceId)) {
        inventory.toggleIngredientShopping(orangeJuiceId);
      }
    },
  },
  {
    id: 'cocktails-all',
    title: 'Spotlight a cocktail',
    text: 'Tap a cocktail to see the full recipe and details.',
    targetId: 'cocktailRow:Bellini',
    routeTo: (router) => {
      router.navigate('/cocktails');
    },
    onNext: ({ inventory, router }) => {
      const belliniId = inventory.getCocktailIdByName('Bellini');
      if (!belliniId) {
        return;
      }
      router.navigate(`/cocktails/${belliniId}`);
    },
  },
  {
    id: 'cocktails-my-shopping',
    title: 'Plan your shopping',
    text: 'Add missing ingredients straight from the My Cocktails view.',
    targetId: 'myCocktails:addOrangeJuiceToShopping',
    routeTo: (router) => {
      router.navigate('/cocktails');
    },
    onNext: ({ inventory }) => {
      const orangeJuiceId = inventory.ensureIngredientIdByName('Orange Juice');
      if (orangeJuiceId == null) {
        return;
      }
      if (!inventory.isIngredientOnShoppingList(orangeJuiceId)) {
        inventory.toggleIngredientShopping(orangeJuiceId);
      }
    },
  },
  {
    id: 'cocktails-my-rating',
    title: 'Rate a cocktail',
    text: 'Give cocktails a rating so favorites rise to the top.',
    targetId: 'cocktailDetails:ratingStars',
    routeTo: (router) => {
      router.navigate('/cocktails');
    },
    onEnter: ({ inventory, router }) => {
      const belliniId = inventory.getCocktailIdByName('Bellini');
      if (!belliniId) {
        return;
      }
      router.navigate(`/cocktails/${belliniId}`);
    },
    onNext: ({ inventory }) => {
      const belliniId = inventory.getCocktailIdByName('Bellini');
      if (!belliniId) {
        return;
      }
      inventory.setCocktailRating(belliniId, 3);
    },
  },
  {
    id: 'cocktails-favorites',
    title: 'Favorites view',
    text: 'Your highest-rated cocktails show up here automatically.',
    targetId: 'cocktailRow:Bellini',
    routeTo: (router) => {
      router.navigate('/cocktails');
    },
    onNext: ({ inventory, router }) => {
      const belliniId = inventory.getCocktailIdByName('Bellini');
      if (!belliniId) {
        return;
      }
      inventory.setCocktailRating(belliniId, 4);
      router.navigate(`/cocktails/${belliniId}`);
    },
  },
  {
    id: 'shaker-intro',
    title: 'Filter logic',
    text: 'Within a single tag we use AND (all selected ingredients must match). Across different tags we use OR.',
    targetId: 'shaker:filterArea',
    routeTo: (router) => {
      router.navigate('/shaker');
    },
  },
  {
    id: 'shaker-select-whiskey',
    title: 'Pick a base spirit',
    text: 'Select Whiskey to start your combination.',
    targetId: 'shaker:ingredientOption:Whiskey',
    routeTo: (router) => {
      router.navigate('/shaker');
    },
  },
  {
    id: 'shaker-select-white-rum',
    title: 'Add another spirit',
    text: 'Add White Rum to broaden the match.',
    targetId: 'shaker:ingredientOption:WhiteRum',
    routeTo: (router) => {
      router.navigate('/shaker');
    },
  },
  {
    id: 'shaker-select-cola',
    title: 'Add a mixer',
    text: 'Select Cola to round out the selection.',
    targetId: 'shaker:ingredientOption:Cola',
    routeTo: (router) => {
      router.navigate('/shaker');
    },
  },
  {
    id: 'shaker-show',
    title: 'Show matches',
    text: 'Tap Show to see matching recipes.',
    targetId: 'shaker:showButton',
    routeTo: (router) => {
      router.navigate('/shaker');
    },
  },
];

// TODO: Add scripted demo actions for cocktail ratings.
