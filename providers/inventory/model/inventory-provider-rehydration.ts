type TagLike = {
  id?: number | null;
  name?: string;
  color?: string;
};

type ItemWithTags = {
  tags?: TagLike[] | null;
};

type InventoryLikeState<TCocktail extends ItemWithTags, TIngredient extends ItemWithTags> = {
  cocktails: TCocktail[];
  ingredients: TIngredient[];
};

function buildTagMap(tags: readonly TagLike[]): Map<number, TagLike> {
  return new Map(tags.map((tag) => [Number(tag.id ?? -1), tag]));
}

function hydrateTags<TItem extends ItemWithTags>(items: TItem[], builtins: Map<number, TagLike>): TItem[] {
  return items.map((item) => ({
    ...item,
    tags: item.tags?.map((tag) => {
      const builtinTag = builtins.get(Number(tag.id ?? -1));
      return builtinTag
        ? {
          ...tag,
          id: builtinTag.id,
          name: builtinTag.name,
          color: builtinTag.color,
        }
        : tag;
    }),
  })) as TItem[];
}

export function rehydrateBuiltInTags<
  TCocktail extends ItemWithTags,
  TIngredient extends ItemWithTags,
  TState extends InventoryLikeState<TCocktail, TIngredient>,
>(
  state: TState,
  builtInCocktailTags: readonly TagLike[],
  builtInIngredientTags: readonly TagLike[],
): TState {
  const cocktailMap = buildTagMap(builtInCocktailTags);
  const ingredientMap = buildTagMap(builtInIngredientTags);

  return {
    ...state,
    cocktails: hydrateTags(state.cocktails, cocktailMap),
    ingredients: hydrateTags(state.ingredients, ingredientMap),
  };
}
