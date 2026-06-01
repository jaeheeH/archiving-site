// app/api/posts/[id]/view/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { isUuidParam } from '@/lib/route-params';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const PUBLIC_POST_DETAIL_COLUMNS =
  'id, type, title, subtitle, summary, slug, content, tags, is_published, published_at, created_at, updated_at, title_style, title_image_url, thumbnail_url, category_id, view_count, scrap_count, author_id';

const PUBLIC_AUTHOR_COLUMNS = 'id, nickname, name, avatar_url';

function jsonNoStore(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
    },
  });
}

function getVisitorHash(request: NextRequest, postId: string) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
  const realIp = request.headers.get('x-real-ip') || '';
  const userAgent = request.headers.get('user-agent') || '';
  const source = `${postId}:${forwardedFor || realIp}:${userAgent}`;

  return createHash('sha256').update(source).digest('hex');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params;
  try {
    if (!isUuidParam(postId)) {
      return NextResponse.json(
        { error: '잘못된 포스트 ID입니다' },
        { status: 400 }
      );
    }

    // 1. Service Role 클라이언트 (포스트 조회)
    const supabase = createAdminClient();

    // 2. 포스트 조회
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select(PUBLIC_POST_DETAIL_COLUMNS)
      .eq('id', postId)
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
      const { data: scrapData } = await supabase
        .from('post_scraps')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .maybeSingle();

      userScraped = !!scrapData;
    }

    // 5. 작성자 정보 조회
    const { data: author } = post.author_id
      ? await supabase
          .from('users')
          .select(PUBLIC_AUTHOR_COLUMNS)
          .eq('id', post.author_id)
          .maybeSingle()
      : { data: null };

    // 6. 응답 데이터 구성
    const responseData = {
      ...post,
      author: author || null,
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

// POST: 조회수 증가 (하이브리드: 로그인 사용자는 DB, 비로그인은 클라이언트가 LocalStorage로 중복 체크)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params;
  try {
    if (!isUuidParam(postId)) {
      return NextResponse.json(
        { error: '잘못된 포스트 ID입니다' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: currentPost, error: currentPostError } = await supabase
      .from('posts')
      .select('id, view_count')
      .eq('id', postId)
      .eq('is_published', true)
      .single();

    if (currentPostError || !currentPost) {
      if (currentPostError && currentPostError.code !== 'PGRST116') {
        throw currentPostError;
      }

      return NextResponse.json(
        { error: '포스트를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 1. 현재 사용자 확인
    const supabaseAuth = await createClient();

    const { data: { user } } = await supabaseAuth.auth.getUser();

    // 2️⃣ 로그인 사용자: DB에 저장하고 중복 체크
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    if (user) {
      // 최근 24시간 내 조회 기록 확인
      const { data: recentView, error: recentViewError } = await supabase
        .from('post_views')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .gte('created_at', oneDayAgo)
        .maybeSingle();

      if (recentViewError) {
        throw recentViewError;
      }

      // 24시간 내 조회 기록이 있으면 카운트 안 함
      if (recentView) {
        return jsonNoStore(
          {
            message: '오늘 이미 조회한 글입니다',
            viewCount: currentPost.view_count || 0,
            incremented: false,
            isLoggedIn: true
          }
        );
      }

      // INSERT: 새 조회 기록 생성
      const { error: insertError } = await supabase
        .from('post_views')
        .insert({
          post_id: postId,
          user_id: user.id,
          visitor_hash: null,
        });

      if (insertError) {
        console.error('조회 기록 저장 실패:', insertError.message);
        return NextResponse.json(
          {
            message: '조회 기록 저장 실패',
            viewCount: currentPost.view_count || 0,
            incremented: false,
            error: insertError.message,
            isLoggedIn: true
          },
          { status: 500 }
        );
      }

      const newViewCount = (currentPost?.view_count || 0) + 1;

      const { data: updatedPost, error: updateError } = await supabase
        .from('posts')
        .update({ view_count: newViewCount })
        .eq('id', postId)
        .select('view_count')
        .single();

      if (updateError) {
        throw updateError;
      }

      return jsonNoStore(
        {
          message: '조회수가 증가했습니다',
          viewCount: updatedPost?.view_count || 0,
          incremented: true,
          isLoggedIn: true
        }
      );
    }

    // 3️⃣ 비로그인 사용자: 서버에서도 방문자 해시로 24시간 중복 체크
    const visitorHash = getVisitorHash(request, postId);
    const { data: recentAnonymousView, error: recentAnonymousViewError } = await supabase
      .from('post_views')
      .select('id')
      .eq('post_id', postId)
      .eq('visitor_hash', visitorHash)
      .gte('created_at', oneDayAgo)
      .maybeSingle();

    if (recentAnonymousViewError) {
      throw recentAnonymousViewError;
    }

    if (recentAnonymousView) {
      return jsonNoStore(
        {
          message: '오늘 이미 조회한 글입니다',
          viewCount: currentPost.view_count || 0,
          incremented: false,
          isLoggedIn: false,
        }
      );
    }

    const { error: anonymousInsertError } = await supabase
      .from('post_views')
      .insert({
        post_id: postId,
        user_id: null,
        visitor_hash: visitorHash,
      });

    if (anonymousInsertError) {
      console.error('익명 조회 기록 저장 실패:', anonymousInsertError.message);
      return NextResponse.json(
        {
          message: '조회 기록 저장 실패',
          viewCount: currentPost.view_count || 0,
          incremented: false,
          isLoggedIn: false,
        },
        { status: 500 }
      );
    }

    const newViewCount = (currentPost?.view_count || 0) + 1;

    const { data: updatedPost, error: anonymousUpdateError } = await supabase
      .from('posts')
      .update({ view_count: newViewCount })
      .eq('id', postId)
      .select('view_count')
      .single();

    if (anonymousUpdateError) {
      throw anonymousUpdateError;
    }

    return jsonNoStore(
      {
        message: '조회수가 증가했습니다',
        viewCount: updatedPost?.view_count || 0,
        incremented: true,
        isLoggedIn: false
      }
    );
  } catch (err) {
    console.error('View count API error:', err);
    return NextResponse.json(
      { error: '서버 오류' },
      { status: 500 }
    );
  }
}
