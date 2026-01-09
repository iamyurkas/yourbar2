export type CocktailMethodId =
  | 'build'
  | 'stir'
  | 'shake'
  | 'muddle'
  | 'layer'
  | 'blend'
  | 'throwing';

export type CocktailMethod = {
  id: CocktailMethodId;
  label: string;
  title: string;
  description: string;
  example: string;
};

export const COCKTAIL_METHODS: CocktailMethod[] = [
  {
    id: 'build',
    label: 'Build (Білд)',
    title: 'Побудова',
    description:
      'Найпростіший метод: інгредієнти наливаються безпосередньо в келих, у якому напій буде подаватися.',
    example: 'Gin & Tonic, Cuba Libre.',
  },
  {
    id: 'stir',
    label: 'Stir (Стір)',
    title: 'Перемішування',
    description: 'Змішування барною ложкою у змішувальному стакані з великою кількістю льоду.',
    example: 'Negroni, Martini, Old Fashioned.',
  },
  {
    id: 'shake',
    label: 'Shake (Шейк)',
    title: 'Збивання',
    description:
      'Інтенсивне збивання інгредієнтів у шейкері з льодом. Якщо у складі є цитрусові соки, цукровий сироп, вершки або білок.',
    example: 'Margarita, Daiquiri, Whiskey Sour.',
  },
  {
    id: 'muddle',
    label: 'Muddle (Мадлінг)',
    title: 'Розтирання',
    description:
      'Використання мадлера (товкачки) для вичавлювання соку, ефірних олій або аромату з фруктів, ягід чи трав.',
    example: 'Mojito, Caipirinha.',
  },
  {
    id: 'layer',
    label: 'Layer (Лейєринг)',
    title: 'Нашарування',
    description:
      'Наливання інгредієнтів шарами за допомогою барної ложки, використовуючи різницю в щільності напоїв.',
    example: 'B-52.',
  },
  {
    id: 'blend',
    label: 'Blend (Бленд)',
    title: 'Збивання в блендері',
    description: 'Змішування з колотим льодом (crushed ice) до стану "снігової каші".',
    example: 'Frozen Margarita, Pina Colada.',
  },
  {
    id: 'throwing',
    label: 'Throwing (Троуінг)',
    title: 'Переливання',
    description:
      'Ефектний метод переливання напою з однієї металевої частини шейкера в іншу з великої відстані.',
    example: 'Bloody Mary, іноді вермутові коктейлі.',
  },
];

export function getCocktailMethodById(id?: string | null): CocktailMethod | undefined {
  if (!id) {
    return undefined;
  }
  return COCKTAIL_METHODS.find((method) => method.id === id);
}
