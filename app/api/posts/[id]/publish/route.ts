// app/api/posts/[id]/publish/route.ts

import { NextRequest } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { CACHE_TAGS } from '@/lib/public-data';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkPostOwnershipOrAdmin } from '@/lib/supabase/post-utils';

// PATCH: 발행 상태만 토글
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const permCheck = await checkPostOwnershipOrAdmin(id);
    if (!permCheck.authorized) return permCheck.error;

    const supabase = createAdminClient();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: '잘못된 JSON 요청입니다' }, { status: 400 });
    }

    const isPublished = (body as { is_published?: unknown }).is_published;
    if (typeof isPublished !== 'boolean') {
      return Response.json(
        { error: 'is_published 값은 boolean이어야 합니다' },
        { status: 400 }
      );
    }

    // 기존 포스트 조회
    const { data: existingPost, error: existingPostError } = await supabase
      .from('posts')
      .select('published_at, is_published, slug, type')
      .eq('id', id)
      .maybeSingle();

    if (existingPostError) {
      return Response.json({ error: existingPostError.message }, { status: 400 });
    }

    if (!existingPost) {
      return Response.json(
        { error: '포스트를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // published_at 로직: 처음 발행하는 경우에만 현재 시간 설정
    let published_at = existingPost?.published_at || null;
    if (isPublished && !existingPost?.is_published) {
      published_at = new Date().toISOString();
    } else if (!isPublished) {
      published_at = null;
    }

    // DB 업데이트
    const { data, error } = await supabase
      .from('posts')
      .update({
        is_published: isPublished,
        published_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, slug, type, is_published, published_at, updated_at')
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    revalidateTag(CACHE_TAGS.posts, "max");
    revalidateTag(CACHE_TAGS.home, "max");
    if (data.type === 'blog') {
      revalidatePath('/blog');
      if (data.slug) revalidatePath(`/blog/${data.slug}`);
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
