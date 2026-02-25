const CYRILLIC_TO_SORT_TOKEN: Record<string, string> = {
  А: "A",
  Б: "BA",
  В: "BBA",
  Г: "BBH",
  Ґ: "BG",
  Д: "DA",
  Е: "EA",
  Є: "ED",
  Ж: "EZH",
  З: "EZZ",
  И: "EZZY",
  І: "IA",
  Ї: "IY",
  Й: "IZ",
  К: "K",
  Л: "L",
  М: "M",
  Н: "N",
  О: "O",
  П: "P",
  Р: "R",
  С: "S",
  Т: "T",
  У: "UA",
  Ф: "UF",
  Х: "XHA",
  Ц: "XHCA",
  Ч: "XHCH",
  Ш: "XSHA",
  Щ: "XSHCH",
  Ь: "XZ",
  Ю: "YZU",
  Я: "YZYA",
};

function normalizeLatinChar(char: string): string {
  return char.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase();
}

function toGlobalSortKey(value: string): string {
  const upper = value.normalize("NFKC").toUpperCase();
  let key = "";

  for (const char of upper) {
    const mapped = CYRILLIC_TO_SORT_TOKEN[char];
    if (mapped) {
      key += `${mapped}~`;
      continue;
    }

    key += `${normalizeLatinChar(char)} `;
  }

  return key;
}

export function compareGlobalAlphabet(left: string, right: string): number {
  const keyLeft = toGlobalSortKey(left);
  const keyRight = toGlobalSortKey(right);

  if (keyLeft < keyRight) {
    return -1;
  }
  if (keyLeft > keyRight) {
    return 1;
  }

  const normalizedLeft = left.normalize("NFKC").toUpperCase();
  const normalizedRight = right.normalize("NFKC").toUpperCase();

  if (normalizedLeft < normalizedRight) {
    return -1;
  }
  if (normalizedLeft > normalizedRight) {
    return 1;
  }

  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }

  return 0;
}

export function compareOptionalGlobalAlphabet(
  left?: string | null,
  right?: string | null,
): number {
  return compareGlobalAlphabet(left ?? "", right ?? "");
}
