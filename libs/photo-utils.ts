export const sanitizeFileSegment = (value: string) => {
  const trimmed = value.trim().toLowerCase();
  const sanitized = trimmed.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return sanitized || 'photo';
};

export const buildPhotoBaseName = (id: number | string, name: string) => {
  const normalizedId = String(id ?? '').trim() || 'photo';
  return `${normalizedId}-${sanitizeFileSegment(name)}`;
};

export const buildPhotoFileName = (
  id: number | string,
  name: string,
  extension = 'jpg',
  suffix?: string,
) => {
  const baseName = buildPhotoBaseName(id, name);
  const normalizedSuffix = suffix ? sanitizeFileSegment(suffix) : '';
  const fileBase = normalizedSuffix ? `${baseName}-${normalizedSuffix}` : baseName;
  return `${fileBase}.${extension}`;
};
