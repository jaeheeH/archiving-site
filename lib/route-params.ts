export function parsePositiveIntParam(value: string) {
  if (!/^\d+$/.test(value)) return null;

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return null;

  return parsed;
}

export function isUuidParam(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function isSlugParam(value: string, maxLength = 180) {
  return value.length > 0 && value.length <= maxLength && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function normalizePostTypeParam(value: string | null, fallback = "blog") {
  if (!value) return fallback;
  return /^[a-z0-9_-]{1,40}$/.test(value) ? value : null;
}

export function isSafeIdentifierParam(value: string, maxLength = 80) {
  return value.length > 0 && value.length <= maxLength && /^[a-zA-Z0-9_-]+$/.test(value);
}
