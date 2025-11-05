export interface Cocktail {
  id: string;
  name: string;
  missingIngredients: number;
  description: string;
  category: string;
  status: 'missing' | 'partial' | 'ready';
}

export const cocktails: Cocktail[] = [
  {
    id: '1',
    name: '1910',
    missingIngredients: 3,
    description: 'Missing: Dry Sherry, Red Vermouth, Orange Bitters, Ice',
    category: 'IBA Official',
    status: 'partial',
  },
  {
    id: '2',
    name: '20th Century Cocktail',
    missingIngredients: 3,
    description: 'Missing: Lillet Blanc, Creme de Cacao, Lemon',
    category: 'Contemporary',
    status: 'missing',
  },
  {
    id: '3',
    name: 'ABC',
    missingIngredients: 2,
    description: 'Missing: Amaretto, Irish Cream',
    category: 'Shooter',
    status: 'partial',
  },
];
