export type CocktailFeedbackExport = Record<string, { rating?: number; comment?: string }>;

export type InventoryExportDataLike = {
  cocktailFeedback?: unknown;
  ingredientStatus?: unknown;
};

export function buildCocktailFeedbackExport(
  ratingsByCocktailId: Record<string, number>,
  commentsByCocktailId: Record<string, string>,
  sanitize: {
    ratings: (value: Record<string, number>) => Record<string, number>;
    comments: (value: Record<string, string>) => Record<string, string>;
  },
): CocktailFeedbackExport {
  const sanitizedRatings = sanitize.ratings(ratingsByCocktailId);
  const sanitizedComments = sanitize.comments(commentsByCocktailId);
  const feedback: CocktailFeedbackExport = {};

  Object.entries(sanitizedRatings).forEach(([id, rating]) => {
    feedback[id] = { ...(feedback[id] ?? {}), rating };
  });

  Object.entries(sanitizedComments).forEach(([id, comment]) => {
    feedback[id] = { ...(feedback[id] ?? {}), comment };
  });

  return feedback;
}

export function parseCocktailFeedbackImport(
  data: InventoryExportDataLike | undefined,
  sanitize: {
    ratings: (value: Record<string, number>) => Record<string, number>;
    comments: (value: Record<string, string>) => Record<string, string>;
  },
): {
  ratings: Record<string, number>;
  comments: Record<string, string>;
} {
  const feedbackCandidate = data?.cocktailFeedback;
  const ratingsCandidate: Record<string, number> = {};
  const commentsCandidate: Record<string, string> = {};

  if (feedbackCandidate && typeof feedbackCandidate === 'object') {
    Object.entries(feedbackCandidate as Record<string, unknown>).forEach(([id, value]) => {
      if (!value || typeof value !== 'object') {
        return;
      }

      const entry = value as { rating?: unknown; comment?: unknown };
      if (typeof entry.rating === 'number') {
        ratingsCandidate[id] = entry.rating;
      }
      if (typeof entry.comment === 'string') {
        commentsCandidate[id] = entry.comment;
      }
    });
  }

  const ratings = sanitize.ratings(ratingsCandidate);
  const comments = sanitize.comments(commentsCandidate);

  return { ratings, comments };
}

export function buildIngredientStatusExport(
  availableIngredientIds: Set<number>,
  shoppingIngredientIds: Set<number>,
  toSortedArray: (value: Set<number>) => number[],
): Record<string, { available?: true; shopping?: true }> {
  const status: Record<string, { available?: true; shopping?: true }> = {};

  toSortedArray(availableIngredientIds).forEach((id) => {
    status[String(id)] = { ...(status[String(id)] ?? {}), available: true };
  });

  toSortedArray(shoppingIngredientIds).forEach((id) => {
    status[String(id)] = { ...(status[String(id)] ?? {}), shopping: true };
  });

  return status;
}

export function parseIngredientStatusImport(data: InventoryExportDataLike | undefined): {
  availableIngredientIds: Set<number>;
  shoppingIngredientIds: Set<number>;
} {
  const statusCandidate = data?.ingredientStatus;
  const availableIngredientIds = new Set<number>();
  const shoppingIngredientIds = new Set<number>();

  if (!statusCandidate || typeof statusCandidate !== 'object') {
    return { availableIngredientIds, shoppingIngredientIds };
  }

  Object.entries(statusCandidate as Record<string, unknown>).forEach(([id, value]) => {
    const numericId = Number(id);
    if (!Number.isFinite(numericId) || numericId < 0 || !value || typeof value !== 'object') {
      return;
    }

    const normalizedId = Math.trunc(numericId);
    const entry = value as { available?: unknown; shopping?: unknown };
    if (entry.available === true) {
      availableIngredientIds.add(normalizedId);
    }
    if (entry.shopping === true) {
      shoppingIngredientIds.add(normalizedId);
    }
  });

  return { availableIngredientIds, shoppingIngredientIds };
}
