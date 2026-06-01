// app/api/posts/[id]/route.ts

import { revalidatePath, revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { CACHE_TAGS } from '@/lib/public-data';
import { getErrorMessage } from '@/lib/error-message';
import { isSlugParam, normalizePostTypeParam } from '@/lib/route-params';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkPostOwnershipOrAdmin } from '@/lib/supabase/post-utils';

interface Props {
  params: Promise<{ id: string }>;
}

const EDIT_POST_COLUMNS =
  'id, type, title, subtitle, summary, slug, content, tags, is_published, published_at, created_at, updated_at, title_style, title_image_url, thumbnail_url, category_id, view_count, scrap_count, author_id';

function revalidateBlogPostPaths(post: { type?: string | null; slug?: string | null }) {
  if (post.type !== 'blog') return;
  revalidatePath('/blog');
  if (post.slug) revalidatePath(`/blog/${post.slug}`);
}

/**
 * GET /api/posts/[id]
 * 특정 포스트 조회
 */
export async function GET(
  request: NextRequest,
  { params }: Props
) {
  try {
    const { id } = await params;
    const permCheck = await checkPostOwnershipOrAdmin(id);
    if (!permCheck.authorized) return permCheck.error;

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('posts')
      .select(EDIT_POST_COLUMNS)
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: '포스트를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { data },
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, no-store',
        },
      }
    );
  } catch (err: unknown) {
    console.error('API 에러:', err);
    return NextResponse.json(
      { error: getErrorMessage(err, '서버 오류') },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/posts/[id]
 * 포스트 수정 (slug 변경 감지 및 이력 저장)
 */
export async function PUT(
  request: NextRequest,
  { params }: Props
) {
  try {
    const { id } = await params;
    const permCheck = await checkPostOwnershipOrAdmin(id);
    if (!permCheck.authorized) return permCheck.error;

    // DB 작업용 Service Role 클라이언트
    const supabase = createAdminClient();

    // 1. 요청 데이터 받기
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: '잘못된 JSON 요청입니다' }, { status: 400 });
    }

    const {
      type,
      title,
      subtitle,
      summary,
      slug,
      content,
      category_id,
      tags,
      title_style,
      title_image_url,
      is_published,
      published_at,
    } = body;

    // 2. 기존 포스트 조회 (현재 slug 확인)
    const { data: existingPost, error: getError } = await supabase
      .from('posts')
      .select('id, slug, type')
      .eq('id', id)
      .single();

    if (getError || !existingPost) {
      return NextResponse.json(
        { error: '포스트를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    const oldSlug = existingPost.slug;
    const newSlug = typeof slug === 'string' ? slug.trim() : slug;
    const slugProvided = slug !== undefined;
    const slugChanged = typeof newSlug === 'string' && oldSlug !== newSlug;

    // 3. slug가 변경된 경우, 유효성 검사
    if (slugProvided) {
      if (typeof newSlug !== 'string' || !isSlugParam(newSlug)) {
        return NextResponse.json(
          { error: 'slug는 소문자, 숫자, 하이픈만 사용 가능' },
          { status: 400 }
        );
      }
    }

    if (slugChanged) {
      // 다른 포스트에서 이미 사용 중인 slug인지 확인
      const { data: conflictPost } = await supabase
        .from('posts')
        .select('id')
        .eq('slug', newSlug)
        .neq('id', id)
        .maybeSingle();

      if (conflictPost) {
        return NextResponse.json(
          { error: '이미 존재하는 slug입니다' },
          { status: 400 }
        );
      }
    }

    // 4. 포스트 업데이트
    const updateData: Record<string, unknown> = {};
    if (type !== undefined) {
      const postType = typeof type === 'string' ? normalizePostTypeParam(type, '') : null;
      if (!postType) {
        return NextResponse.json({ error: '유효하지 않은 포스트 타입입니다' }, { status: 400 });
      }
      updateData.type = postType;
    }
    if (title !== undefined) updateData.title = title;
    if (subtitle !== undefined) updateData.subtitle = subtitle || null;
    if (summary !== undefined) updateData.summary = summary || null;
    if (slugProvided) updateData.slug = newSlug;
    if (content !== undefined) updateData.content = content;
    if (category_id !== undefined) updateData.category_id = category_id || null;
    if (tags !== undefined) {
      if (!Array.isArray(tags)) {
        return NextResponse.json({ error: 'tags 값은 배열이어야 합니다' }, { status: 400 });
      }
      updateData.tags = tags;
    }
    if (title_style !== undefined) updateData.title_style = title_style;
    if (title_image_url !== undefined) updateData.title_image_url = title_image_url || null;
    if (is_published !== undefined) {
      if (typeof is_published !== 'boolean') {
        return NextResponse.json({ error: 'is_published 값은 boolean이어야 합니다' }, { status: 400 });
      }
      updateData.is_published = is_published;
    }
    if (published_at !== undefined) updateData.published_at = published_at || null;
    updateData.updated_at = new Date().toISOString();

    const { data: updatedPost, error: updateError } = await supabase
      .from('posts')
      .update(updateData)
      .eq('id', id)
      .select(EDIT_POST_COLUMNS)
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      );
    }

    // 5. slug 변경 이력 저장 (변경된 경우만)
    if (slugChanged) {
      const { error: historyError } = await supabase
        .from('post_slug_history')
        .insert({
          post_id: id,
          old_slug: oldSlug,
          new_slug: newSlug,
        });

      if (historyError) {
        console.error('slug 이력 저장 실패:', historyError);
        // 에러가 나도 포스트 업데이트는 성공했으므로 계속 진행
      }
    }

    revalidateTag(CACHE_TAGS.posts, "max");
    revalidateTag(CACHE_TAGS.home, "max");
    revalidateBlogPostPaths(existingPost);
    revalidateBlogPostPaths(updatedPost);

    // 6. 성공 응답
    return NextResponse.json(
      {
        message: '포스트가 수정되었습니다',
        data: updatedPost,
        slugChanged,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('API 에러:', err);
    return NextResponse.json(
      { error: '서버 오류' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/posts/[id]
 * 포스트 삭제
 */
export async function DELETE(
  request: NextRequest,
  { params }: Props
) {
  try {
    const { id } = await params;
    const permCheck = await checkPostOwnershipOrAdmin(id);
    if (!permCheck.authorized) return permCheck.error;

    const supabase = createAdminClient();

    const { data: existingPost } = await supabase
      .from('posts')
      .select('slug, type')
      .eq('id', id)
      .single();

    // 포스트 삭제 (cascade로 인해 post_slug_history도 함께 삭제됨)
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    revalidateTag(CACHE_TAGS.posts, "max");
    revalidateTag(CACHE_TAGS.home, "max");
    if (existingPost) revalidateBlogPostPaths(existingPost);

    return NextResponse.json(
      { message: '포스트가 삭제되었습니다' },
      { status: 200 }
    );
  } catch (err) {
    console.error('API 에러:', err);
    return NextResponse.json(
      { error: '서버 오류' },
      { status: 500 }
    );
  }
}
