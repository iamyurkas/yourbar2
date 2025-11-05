export interface Ingredient {
  id: string;
  name: string;
  cocktailCount: number;
  category: string;
  status: 'missing' | 'partial' | 'ready';
}

export const ingredients: Ingredient[] = [
  {
    id: '1',
    name: '7-Up',
    cocktailCount: 12,
    category: 'Soft drink',
    status: 'ready',
  },
  {
    id: '2',
    name: 'Absolut Citron',
    cocktailCount: 15,
    category: 'Vodka',
    status: 'ready',
  },
  {
    id: '3',
    name: 'Agave Syrup',
    cocktailCount: 6,
    category: 'Syrup',
    status: 'partial',
  },
];
