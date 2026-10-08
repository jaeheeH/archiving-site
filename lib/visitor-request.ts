import { isIP } from 'node:net';

// Vercel overwrites its forwarding headers; headers on arbitrary/self-hosted requests are not trusted.
export function visitorNetwork(headers: Headers, trusted = process.env.VERCEL === '1') {
  if (!trusted) return { ip_address: null, country_code: null };
  const ip = (headers.get('x-vercel-forwarded-for') || headers.get('x-forwarded-for') || '').trim();
  const country = headers.get('x-vercel-ip-country') || '';
  return { ip_address: isIP(ip) ? ip : null, country_code: /^[A-Z]{2}$/.test(country) ? country : null };
}

export function visitorEnvironment(agent: string) {
  const browser = /Edg(?:e|A|iOS)?\//i.test(agent) ? 'Edge' : /OPR\/|Opera/i.test(agent) ? 'Opera' : /SamsungBrowser\//i.test(agent) ? 'Samsung Internet' : /Firefox\/|FxiOS\//i.test(agent) ? 'Firefox' : /Chrome\/|CriOS\//i.test(agent) ? 'Chrome' : /Safari\//i.test(agent) ? 'Safari' : '기타';
  const os = /iPhone|iPad|iPod|Macintosh.*Mobile/i.test(agent) ? 'iOS' : /Android/i.test(agent) ? 'Android' : /Windows/i.test(agent) ? 'Windows' : /CrOS/i.test(agent) ? 'ChromeOS' : /Macintosh|Mac OS X/i.test(agent) ? 'macOS' : /Linux/i.test(agent) ? 'Linux' : '기타';
  return { browser, os };
}
