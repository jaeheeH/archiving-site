const MAX_AVATAR_URL_LENGTH = 2048;

export function normalizeAvatarUrl(value: unknown) {
  if (typeof value !== "string") return null;

  const rawUrl = value.trim().slice(0, MAX_AVATAR_URL_LENGTH);
  if (!rawUrl) return null;

  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;

    if (url.protocol === "http:" && url.hostname.endsWith("kakaocdn.net")) {
      url.protocol = "https:";
    }

    return url.toString();
  } catch {
    return null;
  }
}
