const SEOUL_TIME_ZONE = "Asia/Seoul";

const koreanDateFormatters = {
  long: new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: SEOUL_TIME_ZONE,
  }),
  short: new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: SEOUL_TIME_ZONE,
  }),
  monthDay: new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    timeZone: SEOUL_TIME_ZONE,
  }),
};

export function formatKoreanDate(
  value?: string | Date | null,
  style: keyof typeof koreanDateFormatters = "long",
  fallback = "날짜 없음"
) {
  if (!value) return fallback;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return koreanDateFormatters[style].format(date);
}

export function getSeoulDateKey(value: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: SEOUL_TIME_ZONE,
  }).format(value);
}
