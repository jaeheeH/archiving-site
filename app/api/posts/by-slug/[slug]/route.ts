// app/api/posts/by-slug/[slug]/route.ts

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // 1. Service Role 클라이언트 (포스트 조회)
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 2. 포스트 조회 (발행된 글만)
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
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
        .eq('post_id', post.id)
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