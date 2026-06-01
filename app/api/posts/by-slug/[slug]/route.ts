// app/api/posts/by-slug/[slug]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { isSlugParam } from '@/lib/route-params';
import { createPublicClient } from '@/lib/supabase/public';
import { createClient } from '@/lib/supabase/server';

const POST_SCRAP_STATUS_COLUMNS = 'id, scrap_count';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!isSlugParam(slug)) {
      return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 });
    }

    const supabase = createPublicClient();

    // 2. 포스트 조회 (발행된 글만)
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select(POST_SCRAP_STATUS_COLUMNS)
      .eq('slug', slug)
      .eq('type', 'blog')
      .eq('is_published', true)
      .single();

    if (postError || !post) {
      return NextResponse.json(
        { error: '포스트를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 3. 현재 사용자 확인
    const supabaseAuth = await createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    // 4. 현재 사용자가 스크랩했는지 확인
    let userScraped = false;
    if (user) {
      const { data: scrapData } = await supabaseAuth
        .from('post_scraps')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', user.id)
        .maybeSingle();

      userScraped = !!scrapData;
    }

    // 5. 응답 데이터 구성
    const responseData = {
      scrap_count: post.scrap_count || 0,
      userScraped,
    };

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    console.error('Post detail API error:', err);
    return NextResponse.json(
      { error: '서버 오류' },
      { status: 500 }
    );
  }
}
