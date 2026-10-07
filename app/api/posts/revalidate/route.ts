// app/api/revalidate/route.ts

import { revalidatePath, revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { CACHE_TAGS } from '@/lib/public-data';
import { getErrorMessage } from '@/lib/error-message';
import { checkPostEditPermission } from '@/lib/supabase/post-utils';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function parseJsonObject(request: NextRequest) {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const permCheck = await checkPostEditPermission();
    if (!permCheck.authorized) return permCheck.error;

    // 요청 본문에서 slug 추출
    const body = await parseJsonObject(request);
    if (!body) {
      return NextResponse.json({ error: '잘못된 JSON 요청입니다.' }, { status: 400 });
    }

    const { slug } = body;

    // slug 검증
    if (!slug || typeof slug !== 'string' || !SLUG_PATTERN.test(slug)) {
      return NextResponse.json(
        { error: '유효한 slug가 필요합니다' },
        { status: 400 }
      );
    }

    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 });
    // Article aliases, feeds and the current public routes share the same content.
    revalidatePath(`/blog/${slug}`);
    for (const path of [`/news/read/${slug}`, '/', '/news/stories', '/blog', '/rss.xml', '/sitemap.xml']) revalidatePath(path);
    revalidateTag('archb-news', { expire: 0 });
    revalidateTag(CACHE_TAGS.posts, { expire: 0 });
    revalidateTag(CACHE_TAGS.home, { expire: 0 });

    return NextResponse.json(
      {
        success: true,
        message: `기사 "${slug}"이(가) 재검증되었습니다`,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    const message = getErrorMessage(error, '재검증 중 오류가 발생했습니다');
    console.error('❌ 재검증 실패:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
