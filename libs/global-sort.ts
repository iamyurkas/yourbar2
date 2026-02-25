export function compareGlobalAlphabet(left: string, right: string): number {
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
