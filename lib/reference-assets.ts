import { lookup } from 'node:dns/promises';
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { BlockList, isIP } from 'node:net';
import sharp from 'sharp';

const blocked = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blocked.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of [['2001::', 23], ['2001:db8::', 32], ['2002::', 16]] as const) blocked.addSubnet(address, prefix, 'ipv6');
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');

export function isPublicReferenceAddress(address: string) {
  const family = isIP(address);
  return family === 4 ? !blocked.check(address, 'ipv4')
    : family === 6 && globalV6.check(address, 'ipv6') && !blocked.check(address, 'ipv6');
}

export async function readRemoteReferenceImage(source: string, maxBytes: number) {
  let url = new URL(source);
  const signal = AbortSignal.timeout(12_000);
  for (let redirects = 0; redirects < 4; redirects++) {
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) throw new Error('Unsupported image address');
    const addresses = await lookup(url.hostname, { all: true });
    if (!addresses.length || addresses.some(({ address }) => !isPublicReferenceAddress(address))) throw new Error('Private image address');
    // Pin the checked DNS result so a second lookup cannot reach an internal address.
    const response = await new Promise<IncomingMessage>((resolve, reject) => {
      const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
        signal, family: addresses[0].family,
        lookup: (_hostname, _options, callback) => callback(null, addresses[0].address, addresses[0].family),
        headers: { Accept: 'image/png,image/jpeg,image/webp,image/gif', 'User-Agent': 'ARCH-B Reference Clipper/0.2' },
      }, resolve);
      request.on('error', reject).end();
    });
    const status = response.statusCode || 0;
    if ([301, 302, 303, 307, 308].includes(status)) {
      response.destroy();
      if (!response.headers.location) throw new Error('Missing image redirect');
      url = new URL(response.headers.location, url);
      continue;
    }
    const contentType = response.headers['content-type']?.split(';')[0]?.trim().toLowerCase();
    if (status !== 200 || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(contentType || '')
        || Number(response.headers['content-length']) > maxBytes) {
      response.destroy();
      throw new Error('Image unavailable or too large');
    }
    const chunks: Buffer[] = [];
    let size = 0;
    try {
      for await (const chunk of response) {
        size += chunk.length;
        if (size > maxBytes) throw new Error('Image too large');
        chunks.push(chunk);
      }
    } finally { response.destroy(); }
    return Buffer.concat(chunks);
  }
  throw new Error('Too many image redirects');
}

export async function referenceImageWebp(buffer: Buffer, kind: 'thumbnail' | 'logo') {
  const image = sharp(buffer, { limitInputPixels: 40_000_000 });
  const metadata = await image.metadata();
  if (!['jpeg', 'png', 'webp', 'gif'].includes(metadata.format || '')) throw new Error('Unsupported image file');
  const size = kind === 'logo' ? 256 : 1280;
  return image.rotate().resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
}

export function readCapturedReferenceImage(value: unknown) {
  if (typeof value !== 'string' || value.length > Math.ceil(8 * 1024 * 1024 * 4 / 3) + 64) throw new Error('캡처 이미지는 최대 8MB까지 등록할 수 있습니다.');
  const match = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw new Error('올바른 캡처 이미지가 필요합니다.');
  const buffer = Buffer.from(match[1], 'base64');
  if (!buffer.length || buffer.length > 8 * 1024 * 1024 || buffer.toString('base64') !== match[1]) throw new Error('올바른 캡처 이미지가 필요합니다.');
  return buffer;
}
