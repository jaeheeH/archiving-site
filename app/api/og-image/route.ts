import { NextRequest } from 'next/server';
import { readOgImage } from '@/lib/og-image';
import { canOptimizeImage } from '@/lib/public-image';
export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  const src = request.nextUrl.searchParams.get('src');
  if (!src || !canOptimizeImage(src) || src.startsWith('/')) return Response.json({ error: 'Invalid image source' }, { status: 400 });
  try {
    return new Response(new Uint8Array(await readOgImage(src)), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } });
  } catch { return Response.json({ error: 'Image unavailable' }, { status: 502 }); }
}
