const CYRILLIC_TO_SORT_TOKEN: Record<string, string> = {
  А: 'A',
  Б: 'B',
  В: 'V',
  Г: 'H',
  Ґ: 'G',
  Д: 'D',
  Е: 'E',
  Є: 'EZ',
  Ж: 'ZH',
  З: 'Z',
  И: 'Y',
  І: 'I',
  Ї: 'IZ',
  Й: 'YZ',
  К: 'K',
  Л: 'L',
  М: 'M',
  Н: 'N',
  О: 'O',
  П: 'P',
  Р: 'R',
  С: 'S',
  Т: 'T',
  У: 'U',
  Ф: 'F',
  Х: 'XH',
  Ц: 'XC',
  Ч: 'XCH',
  Ш: 'XSH',
  Щ: 'XSHCH',
  Ь: 'XZ',
  Ю: 'YYU',
  Я: 'YYA',
};

function normalizeLatinChar(char: string): string {
  return char
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase();
}

function toGlobalSortKey(value: string): string {
  const upper = value.normalize('NFKC').toUpperCase();
  let key = '';

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

  const normalizedLeft = left.normalize('NFKC').toUpperCase();
  const normalizedRight = right.normalize('NFKC').toUpperCase();

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
  return compareGlobalAlphabet(left ?? '', right ?? '');
}
