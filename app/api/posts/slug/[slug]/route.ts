// app/api/posts/slug/[slug]/route.ts

import { NextRequest } from 'next/server';
import { PUBLIC_API_CACHE_CONTROL } from '@/lib/public-data';
import { isSlugParam, normalizePostTypeParam } from '@/lib/route-params';
import { createPublicClient } from '@/lib/supabase/public';

const PUBLIC_POST_DETAIL_COLUMNS =
  'id, type, title, subtitle, summary, slug, content, tags, is_published, published_at, created_at, updated_at, title_style, title_image_url, thumbnail_url, category_id, view_count, scrap_count, author_id';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const type = normalizePostTypeParam(searchParams.get('type'));

    if (!isSlugParam(slug) || !type) {
      return Response.json({ error: '잘못된 요청입니다' }, { status: 400 });
    }

    const supabase = createPublicClient();

    const { data, error } = await supabase
      .from('posts')
      .select(PUBLIC_POST_DETAIL_COLUMNS)
      .eq('slug', slug)
      .eq('type', type)
      .eq('is_published', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return Response.json({ error: '포스트를 찾을 수 없습니다' }, { status: 404 });
      }
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json(
      { data },
      {
        status: 200,
        headers: {
          'Cache-Control': PUBLIC_API_CACHE_CONTROL,
        },
      }
    );
  } catch (err) {
    console.error('API 에러:', err);
    return Response.json({ error: '서버 오류' }, { status: 500 });
  }
}
