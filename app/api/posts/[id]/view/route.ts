// app/api/posts/[id]/view/route.ts

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params;
  try {
    // 1. Service Role 클라이언트 (포스트 조회)
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 2. 포스트 조회
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('*')
      .eq('id', postId)
      .single();

    if (postError || !post) {
      return NextResponse.json(
        { error: '포스트를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 3. 현재 사용자 확인
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    const { data: { user } } = await supabaseAuth.auth.getUser();

    // 4. 현재 사용자가 스크랩했는지 확인
    let userScraped = false;
    if (user) {
      const { data: scrapData } = await supabase
        .from('post_scraps')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .single();

      userScraped = !!scrapData;
    }

    // 5. 작성자 정보 조회
    const { data: author } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', post.author_id)
      .single();

    // 6. 응답 데이터 구성
    const responseData = {
      ...post,
      author: author || null,
      userScraped,
    };

    return NextResponse.json(responseData, { status: 200 });
  } catch (err) {
    console.error('Post detail API error:', err);
    return NextResponse.json(
      { error: '서버 오류' },
      { status: 500 }
    );
  }
}

// POST: 조회수 증가 (하이브리드: 로그인 사용자는 DB, 비로그인은 클라이언트가 처리)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params;
  try {
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. 현재 사용자 확인
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    const { data: { user } } = await supabaseAuth.auth.getUser();

    // 2️⃣ 로그인 사용자: DB에 저장
    if (user) {
      // 최근 24시간 내 조회 기록 확인
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: recentView } = await supabase
        .from('post_views')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .gte('created_at', oneDayAgo)
        .maybeSingle();

      // 24시간 내 조회 기록이 있으면 카운트 안 함
      if (recentView) {
        const { data: post } = await supabase
          .from('posts')
          .select('view_count')
          .eq('id', postId)
          .single();

        return NextResponse.json(
          {
            message: '오늘 이미 조회한 글입니다',
            viewCount: post?.view_count || 0,
            incremented: false,
            isLoggedIn: true
          },
          { status: 200 }
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
        const { data: post } = await supabase
          .from('posts')
          .select('view_count')
          .eq('id', postId)
          .single();

        return NextResponse.json(
          {
            message: '조회 기록 저장 실패',
            viewCount: post?.view_count || 0,
            incremented: false,
            error: insertError.message,
            isLoggedIn: true
          },
          { status: 500 }
        );
      }

      // 조회수 증가
      const { data: currentPost } = await supabase
        .from('posts')
        .select('view_count')
        .eq('id', postId)
        .single();

      const newViewCount = (currentPost?.view_count || 0) + 1;

      const { data: updatedPost } = await supabase
        .from('posts')
        .update({ view_count: newViewCount })
        .eq('id', postId)
        .select('view_count')
        .single();

      return NextResponse.json(
        {
          message: '조회수가 증가했습니다',
          viewCount: updatedPost?.view_count || 0,
          incremented: true,
          isLoggedIn: true
        },
        { status: 200 }
      );
    }

    // 3️⃣ 비로그인 사용자: 클라이언트에서 로컬스토리지로 관리
    // API는 조회수만 증가 (클라이언트가 중복 체크)
    return NextResponse.json(
      {
        message: '비로그인 사용자입니다. 클라이언트에서 처리하세요.',
        viewCount: 0,
        incremented: false,
        isLoggedIn: false
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('View count API error:', err);
    return NextResponse.json(
      { error: '서버 오류' },
      { status: 500 }
    );
  }
}