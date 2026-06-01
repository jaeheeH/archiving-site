// app/api/posts/[id]/scrap/route.ts

import { revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { CACHE_TAGS } from '@/lib/public-data';
import { isUuidParam } from '@/lib/route-params';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;

    if (!isUuidParam(postId)) {
      return NextResponse.json(
        { error: '잘못된 포스트 ID입니다' },
        { status: 400 }
      );
    }

    // 1. 현재 사용자 확인
    const supabaseAuth = await createClient();

    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다', requiresAuth: true },
        { status: 401 }
      );
    }

    // 2. Service Role 클라이언트
    const supabase = createAdminClient();

    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('id')
      .eq('id', postId)
      .eq('is_published', true)
      .maybeSingle();

    if (postError || !post) {
      return NextResponse.json(
        { error: '포스트를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 3. 이미 스크랩했는지 확인
    const { data: existingScrap, error: existingScrapError } = await supabase
      .from('post_scraps')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingScrapError) {
      return NextResponse.json(
        { error: existingScrapError.message },
        { status: 400 }
      );
    }

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

    // 5. 실제 스크랩 테이블 기준으로 scrap_count 동기화
    const { count, error: countError } = await supabase
      .from('post_scraps')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', postId);

    if (countError) {
      return NextResponse.json(
        { error: countError.message },
        { status: 400 }
      );
    }

    const scrapCount = count || 0;

    const { error: updateError } = await supabase
      .from('posts')
      .update({ scrap_count: scrapCount })
      .eq('id', postId);

    if (updateError) {
      console.error('Scrap count update error:', updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      );
    }

    revalidateTag(CACHE_TAGS.posts, 'max');
    revalidateTag(CACHE_TAGS.home, 'max');

    return NextResponse.json(
      {
        message: scrapAdded ? '스크랩되었습니다' : '스크랩이 취소되었습니다',
        scraped: scrapAdded,
        scrapCount,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, no-store',
        },
      }
    );
  } catch (err) {
    console.error('Scrap API error:', err);
    return NextResponse.json(
      { error: '서버 오류' },
      { status: 500 }
    );
  }
}
