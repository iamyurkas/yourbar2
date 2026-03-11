const NON_ALPHANUMERIC = /[^a-z0-9]/gi;

export function normalizeBarcode(value?: string | null): string {
  if (!value) {
    return '';
  }

  return value.replace(NON_ALPHANUMERIC, '').toUpperCase();
}

export function getBarcodeLookupCandidates(value?: string | null): string[] {
  const normalized = normalizeBarcode(value);
  if (!normalized) {
    return [];
  }

  const candidates = new Set<string>([normalized]);

  if (/^\d{12}$/.test(normalized)) {
    candidates.add(`0${normalized}`);
  }

  if (/^0\d{12}$/.test(normalized)) {
    candidates.add(normalized.slice(1));
  }

  return Array.from(candidates);
}
