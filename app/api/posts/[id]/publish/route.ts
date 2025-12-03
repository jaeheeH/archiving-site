// app/api/posts/[id]/publish/route.ts

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

// PATCH: 발행 상태만 토글
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await request.json();
    const { is_published } = body;

    // 기존 포스트 조회
    const { data: existingPost } = await supabase
      .from('posts')
      .select('published_at, is_published')
      .eq('id', id)
      .single();

    if (!existingPost) {
      return Response.json(
        { error: '포스트를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // published_at 로직: 처음 발행하는 경우에만 현재 시간 설정
    let published_at = existingPost?.published_at || null;
    if (is_published && !existingPost?.is_published) {
      published_at = new Date().toISOString();
    } else if (!is_published) {
      published_at = null;
    }

    // DB 업데이트
    const { data, error } = await supabase
      .from('posts')
      .update({
        is_published,
        published_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json(
      {
        message: '발행 상태가 변경되었습니다',
        data,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('API 에러:', err);
    return Response.json({ error: '서버 오류' }, { status: 500 });
  }
}
