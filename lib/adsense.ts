/** Publisher IDs come from the same CMS scripts that actually load AdSense. */
export function adsensePublisherIds(scripts?: string | null) {
  return [...new Set(Array.from(scripts?.matchAll(/\bca-(pub-\d{16})\b/g) || [], match => match[1]))];
}

export function adsenseAdsTxt(scripts?: string | null) {
  const publishers = adsensePublisherIds(scripts);
  return publishers.length ? publishers.map(id => `google.com, ${id}, DIRECT, f08c47fec0942fa0`).join('\n') + '\n' : null;
}
