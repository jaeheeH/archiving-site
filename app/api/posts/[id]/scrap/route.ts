// app/api/posts/[id]/scrap/route.ts

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;

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

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다', requiresAuth: true },
        { status: 401 }
      );
    }

    // 2. Service Role 클라이언트
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 3. 이미 스크랩했는지 확인
    const { data: existingScrap, error: queryError } = await supabase
      .from('post_scraps')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .single();

    let scrapAdded = false;

    // 4. 토글 처리
    if (existingScrap) {
      // 스크랩 취소
      const { error: deleteError } = await supabase
        .from('post_scraps')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id);

      if (deleteError) {
        console.error('Scrap delete error:', deleteError);
        return NextResponse.json(
          { error: deleteError.message },
          { status: 400 }
        );
      }

      scrapAdded = false;
    } else {
      // 스크랩 추가
      const { error: insertError } = await supabase
        .from('post_scraps')
        .insert({
          post_id: postId,
          user_id: user.id,
        });

      if (insertError) {
        console.error('Scrap insert error:', insertError);
        return NextResponse.json(
          { error: insertError.message },
          { status: 400 }
        );
      }

      scrapAdded = true;
    }

    // 5. scrap_count 업데이트
    const { data: post, error: getError } = await supabase
      .from('posts')
      .select('scrap_count')
      .eq('id', postId)
      .single();

    if (getError) {
      console.error('Post fetch error:', getError);
      return NextResponse.json(
        { error: '포스트를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    const currentScrapCount = post?.scrap_count || 0;
    const newScrapCount = scrapAdded ? currentScrapCount + 1 : Math.max(0, currentScrapCount - 1);

    const { error: updateError } = await supabase
      .from('posts')
      .update({ scrap_count: newScrapCount })
      .eq('id', postId);

    if (updateError) {
      console.error('Scrap count update error:', updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        message: scrapAdded ? '스크랩되었습니다' : '스크랩이 취소되었습니다',
        scraped: scrapAdded,
        scrapCount: newScrapCount,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('Scrap API error:', err);
    return NextResponse.json(
      { error: '서버 오류' },
      { status: 500 }
    );
  }
}