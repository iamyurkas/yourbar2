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
) => `${buildPhotoBaseName(id, name)}.${extension}`;
