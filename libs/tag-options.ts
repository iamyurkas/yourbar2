export type TagOption = {
  key: string;
  name: string;
  color: string;
};

type TagLike = {
  id?: number | null;
  name?: string | null;
  color?: string | null;
};

export function buildTagOptions<TItem, TTag extends TagLike>(
  items: readonly TItem[],
  getTags: (item: TItem) => readonly (TTag | null | undefined)[] | null | undefined,
  builtinTags: readonly TTag[],
  defaultColor: string,
): TagOption[] {
  const map = new Map<string, TagOption>();
  const builtinTagOrder = new Map<string, number>();

  builtinTags.forEach((tag, index) => {
    if (tag.id != null) {
      builtinTagOrder.set(String(tag.id), index);
    }
    if (tag.name) {
      builtinTagOrder.set(tag.name.trim().toLowerCase(), index);
    }
  });

  items.forEach((item) => {
    (getTags(item) ?? []).forEach((tag) => {
      if (!tag) {
        return;
      }

      const key = tag.id != null ? String(tag.id) : tag.name?.toLowerCase();
      if (!key) {
        return;
      }

      if (!map.has(key)) {
        map.set(key, {
          key,
          name: tag.name ?? 'Unnamed tag',
          color: tag.color ?? defaultColor,
        });
      }
    });
  });

  return Array.from(map.values()).sort((a, b) => {
    const normalizedNameA = a.name.trim().toLowerCase();
    const normalizedNameB = b.name.trim().toLowerCase();
    const orderA = builtinTagOrder.get(a.key) ?? builtinTagOrder.get(normalizedNameA);
    const orderB = builtinTagOrder.get(b.key) ?? builtinTagOrder.get(normalizedNameB);

    if (orderA != null || orderB != null) {
      if (orderA == null) {
        return 1;
      }

      if (orderB == null) {
        return -1;
      }

      if (orderA !== orderB) {
        return orderA - orderB;
      }
    }

    return normalizedNameA.localeCompare(normalizedNameB);
  });
}
