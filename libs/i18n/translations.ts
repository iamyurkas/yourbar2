import type { UiLocale } from '@/providers/inventory-types';

export type TranslationKey =
  | 'tabs.cocktails'
  | 'tabs.shaker'
  | 'tabs.ingredients'
  | 'topBar.searchPlaceholder'
  | 'topBar.openNavigation'
  | 'topBar.clearSearch'
  | 'topBar.openHelp'
  | 'topBar.filterItems'
  | 'dialog.gotIt'
  | 'sideMenu.settings'
  | 'sideMenu.theme.light'
  | 'sideMenu.theme.dark'
  | 'sideMenu.theme.system'
  | 'sideMenu.theme.set'
  | 'sideMenu.language.title'
  | 'sideMenu.language.caption'
  | 'sideMenu.language.enGB'
  | 'sideMenu.language.ukUA'
  | 'sideMenu.ignoreGarnish.label'
  | 'sideMenu.ignoreGarnish.caption'
  | 'sideMenu.allowSubstitutes.label'
  | 'sideMenu.allowSubstitutes.caption'
  | 'sideMenu.useImperial.label'
  | 'sideMenu.useImperial.caption'
  | 'sideMenu.keepScreenAwake.label'
  | 'sideMenu.keepScreenAwake.caption'
  | 'sideMenu.smartFiltering.label'
  | 'sideMenu.smartFiltering.caption'
  | 'sideMenu.smartFiltering.infoLabel'
  | 'sideMenu.startScreen.label'
  | 'sideMenu.startScreen.caption'
  | 'sideMenu.ratingFilter.label'
  | 'sideMenu.ratingFilter.caption'
  | 'sideMenu.manageTags.label'
  | 'sideMenu.manageTags.caption'
  | 'sideMenu.amazonStore.label'
  | 'sideMenu.amazonStore.caption'
  | 'sideMenu.onboarding.label'
  | 'sideMenu.onboarding.caption'
  | 'sideMenu.backupRestore.label'
  | 'sideMenu.backupRestore.caption'
  | 'sideMenu.reportIssue.label'
  | 'sideMenu.reportIssue.caption'
  | 'sideMenu.version'
  | 'sideMenu.smartFilteringDialog.title'
  | 'sideMenu.smartFilteringDialog.message'
  | 'sideMenu.resetDataDialog.title'
  | 'sideMenu.resetDataDialog.message'
  | 'common.cancel'
  | 'common.restore'
  | 'common.delete'
  | 'common.create'
  | 'common.save'
  | 'common.close'
  | 'common.ok'
  | 'sideMenu.startScreen.allCocktails'
  | 'sideMenu.startScreen.allCocktailsDescription'
  | 'sideMenu.startScreen.myCocktails'
  | 'sideMenu.startScreen.myCocktailsDescription'
  | 'sideMenu.startScreen.favoriteCocktails'
  | 'sideMenu.startScreen.favoriteCocktailsDescription'
  | 'sideMenu.startScreen.shaker'
  | 'sideMenu.startScreen.shakerDescription'
  | 'sideMenu.startScreen.allIngredients'
  | 'sideMenu.startScreen.allIngredientsDescription'
  | 'sideMenu.startScreen.myIngredients'
  | 'sideMenu.startScreen.myIngredientsDescription'
  | 'sideMenu.startScreen.shoppingList'
  | 'sideMenu.startScreen.shoppingListDescription';

type TranslationDictionary = Record<TranslationKey, string>;

const EN_GB: TranslationDictionary = {
  'tabs.cocktails': 'Cocktails',
  'tabs.shaker': 'Shaker',
  'tabs.ingredients': 'Ingredients',
  'topBar.searchPlaceholder': 'Search',
  'topBar.openNavigation': 'Open navigation',
  'topBar.clearSearch': 'Clear search query',
  'topBar.openHelp': 'Open screen help',
  'topBar.filterItems': 'Filter items',
  'dialog.gotIt': 'Got it',
  'sideMenu.settings': 'Settings',
  'sideMenu.theme.light': 'Light',
  'sideMenu.theme.dark': 'Dark',
  'sideMenu.theme.system': 'System',
  'sideMenu.theme.set': 'Set {theme} theme',
  'sideMenu.language.title': 'Language',
  'sideMenu.language.caption': 'Change app interface language',
  'sideMenu.language.enGB': '🇬🇧 English',
  'sideMenu.language.ukUA': '🇺🇦 Українська',
  'sideMenu.ignoreGarnish.label': 'Ignore garnish',
  'sideMenu.ignoreGarnish.caption': 'All garnishes are optional',
  'sideMenu.allowSubstitutes.label': 'Allow all substitutes',
  'sideMenu.allowSubstitutes.caption': 'Always use substitutes',
  'sideMenu.useImperial.label': 'Use imperial units',
  'sideMenu.useImperial.caption': 'oz, lb and Fahrenheit',
  'sideMenu.keepScreenAwake.label': 'Keep screen awake',
  'sideMenu.keepScreenAwake.caption': 'Prevent auto lock while using the app',
  'sideMenu.smartFiltering.label': 'Smart shaker filtering',
  'sideMenu.smartFiltering.caption': 'Hide ingredients that produce no results',
  'sideMenu.smartFiltering.infoLabel': 'Smart shaker filtering info',
  'sideMenu.startScreen.label': 'Starting screen',
  'sideMenu.startScreen.caption': 'Open {screen}',
  'sideMenu.ratingFilter.label': 'Favorites rating filter',
  'sideMenu.ratingFilter.caption': 'Showing {rating}+ stars cocktails',
  'sideMenu.manageTags.label': 'Manage tags',
  'sideMenu.manageTags.caption': 'Create or update your tags',
  'sideMenu.amazonStore.label': 'Amazon store',
  'sideMenu.amazonStore.caption': 'Current: {store}',
  'sideMenu.onboarding.label': 'Restart onboarding',
  'sideMenu.onboarding.caption': 'Show the guided tour again',
  'sideMenu.backupRestore.label': 'Back up & Restore',
  'sideMenu.backupRestore.caption': 'Export your data or restore from backup',
  'sideMenu.reportIssue.label': 'Something wrong?',
  'sideMenu.reportIssue.caption': 'Report a bug, share an idea',
  'sideMenu.version': 'Version {version}',
  'sideMenu.smartFilteringDialog.title': 'Smart shaker filtering',
  'sideMenu.smartFilteringDialog.message': 'When enabled, ingredients in groups with no current selection are hidden if they would produce zero results.\n\nIn groups where you already selected at least one ingredient, items stay visible to preserve OR logic.\n\nTurn this off to restore the default shaker behavior.',
  'sideMenu.resetDataDialog.title': 'Restore bundled data',
  'sideMenu.resetDataDialog.message': 'This will restore the bundled cocktails and ingredients.\nYour custom cocktails and ingredients will stay the same.',
  'common.cancel': 'Cancel',
  'common.restore': 'Restore',
  'common.delete': 'Delete',
  'common.create': 'Create',
  'common.save': 'Save',
  'common.close': 'Close',
  'common.ok': 'OK',
  'sideMenu.startScreen.allCocktails': 'All cocktails',
  'sideMenu.startScreen.allCocktailsDescription': 'Browse every recipe',
  'sideMenu.startScreen.myCocktails': 'My cocktails',
  'sideMenu.startScreen.myCocktailsDescription': 'See your creations first',
  'sideMenu.startScreen.favoriteCocktails': 'Favorite cocktails',
  'sideMenu.startScreen.favoriteCocktailsDescription': 'Jump into saved cocktails',
  'sideMenu.startScreen.shaker': 'Shaker',
  'sideMenu.startScreen.shakerDescription': 'Mix based on your inventory',
  'sideMenu.startScreen.allIngredients': 'All ingredients',
  'sideMenu.startScreen.allIngredientsDescription': 'Manage every ingredient',
  'sideMenu.startScreen.myIngredients': 'My ingredients',
  'sideMenu.startScreen.myIngredientsDescription': 'Start with what you own',
  'sideMenu.startScreen.shoppingList': 'Shopping list',
  'sideMenu.startScreen.shoppingListDescription': 'Head to your shopping items',
};

const UK_UA: Partial<TranslationDictionary> = {
  'tabs.cocktails': 'Коктейлі',
  'tabs.shaker': 'Шейкер',
  'tabs.ingredients': 'Інгредієнти',
  'topBar.searchPlaceholder': 'Пошук',
  'topBar.openNavigation': 'Відкрити навігацію',
  'topBar.clearSearch': 'Очистити пошуковий запит',
  'topBar.openHelp': 'Відкрити довідку екрана',
  'topBar.filterItems': 'Фільтрувати елементи',
  'dialog.gotIt': 'Зрозуміло',
  'sideMenu.settings': 'Налаштування',
  'sideMenu.theme.light': 'Світла',
  'sideMenu.theme.dark': 'Темна',
  'sideMenu.theme.system': 'Системна',
  'sideMenu.theme.set': 'Встановити тему: {theme}',
  'sideMenu.language.title': 'Мова',
  'sideMenu.language.caption': 'Змінити мову інтерфейсу застосунку',
  'sideMenu.ignoreGarnish.label': 'Ігнорувати гарнір',
  'sideMenu.ignoreGarnish.caption': 'Усі гарніри необовʼязкові',
  'sideMenu.allowSubstitutes.label': 'Дозволити всі замінники',
  'sideMenu.allowSubstitutes.caption': 'Завжди використовувати замінники',
  'sideMenu.useImperial.label': 'Використовувати імперські одиниці',
  'sideMenu.useImperial.caption': 'oz, lb та Фаренгейт',
  'sideMenu.keepScreenAwake.label': 'Не вимикати екран',
  'sideMenu.keepScreenAwake.caption': 'Запобігати автоблокуванню під час використання',
  'sideMenu.smartFiltering.label': 'Розумна фільтрація шейкера',
  'sideMenu.smartFiltering.caption': 'Ховати інгредієнти без результатів',
  'sideMenu.smartFiltering.infoLabel': 'Інформація про розумну фільтрацію шейкера',
  'sideMenu.startScreen.label': 'Стартовий екран',
  'sideMenu.startScreen.caption': 'Відкривати {screen}',
  'sideMenu.ratingFilter.label': 'Фільтр рейтингу обраних',
  'sideMenu.ratingFilter.caption': 'Показано коктейлі з {rating}+ зірками',
  'sideMenu.manageTags.label': 'Керувати тегами',
  'sideMenu.manageTags.caption': 'Створюйте та редагуйте власні теги',
  'sideMenu.amazonStore.label': 'Магазин Amazon',
  'sideMenu.amazonStore.caption': 'Поточний: {store}',
  'sideMenu.onboarding.label': 'Перезапустити онбординг',
  'sideMenu.onboarding.caption': 'Знову показати екскурсію',
  'sideMenu.backupRestore.label': 'Резервування і відновлення',
  'sideMenu.backupRestore.caption': 'Експортуйте дані або відновіть із резервної копії',
  'sideMenu.reportIssue.label': 'Щось не так?',
  'sideMenu.reportIssue.caption': 'Повідомте про баг або ідею',
  'sideMenu.version': 'Версія {version}',
  'sideMenu.smartFilteringDialog.title': 'Розумна фільтрація шейкера',
  'sideMenu.resetDataDialog.title': 'Відновити вбудовані дані',
  'common.cancel': 'Скасувати',
  'common.restore': 'Відновити',
  'common.delete': 'Видалити',
  'common.create': 'Створити',
  'common.save': 'Зберегти',
  'common.close': 'Закрити',
  'common.ok': 'OK',
  'sideMenu.startScreen.allCocktails': 'Усі коктейлі',
  'sideMenu.startScreen.allCocktailsDescription': 'Перегляд усіх рецептів',
  'sideMenu.startScreen.myCocktails': 'Мої коктейлі',
  'sideMenu.startScreen.myCocktailsDescription': 'Спочатку ваші власні',
  'sideMenu.startScreen.favoriteCocktails': 'Обрані коктейлі',
  'sideMenu.startScreen.favoriteCocktailsDescription': 'Швидкий доступ до збережених',
  'sideMenu.startScreen.shaker': 'Шейкер',
  'sideMenu.startScreen.shakerDescription': 'Змішуйте за вашим інвентарем',
  'sideMenu.startScreen.allIngredients': 'Усі інгредієнти',
  'sideMenu.startScreen.allIngredientsDescription': 'Керуйте всіма інгредієнтами',
  'sideMenu.startScreen.myIngredients': 'Мої інгредієнти',
  'sideMenu.startScreen.myIngredientsDescription': 'Починайте з того, що маєте',
  'sideMenu.startScreen.shoppingList': 'Список покупок',
  'sideMenu.startScreen.shoppingListDescription': 'Перейдіть до товарів для покупки',
};

export const DEFAULT_UI_LOCALE: UiLocale = 'en-GB';

export const SUPPORTED_UI_LOCALES: Array<{ key: UiLocale; labelKey: TranslationKey; flag: string }> = [
  { key: 'en-GB', labelKey: 'sideMenu.language.enGB', flag: '🇬🇧' },
  { key: 'uk-UA', labelKey: 'sideMenu.language.ukUA', flag: '🇺🇦' },
];

const dictionaries: Record<UiLocale, Partial<TranslationDictionary>> = {
  'en-GB': EN_GB,
  'uk-UA': UK_UA,
};

export function getTranslation(locale: UiLocale, key: TranslationKey): string {
  return dictionaries[locale][key] ?? EN_GB[key];
}
