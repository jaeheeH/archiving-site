// app/api/posts/[id]/route.ts

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

interface Props {
  params: Promise<{ id: string }>;
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

    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json(
        { error: '포스트를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (err) {
    console.error('API 에러:', err);
    return NextResponse.json(
      { error: '서버 오류' },
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
    const cookieStore = await cookies();

    // 세션 확인용 클라이언트
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

    // DB 작업용 Service Role 클라이언트
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. 요청 데이터 받기
    const body = await request.json();
    const {
      type,
      title,
      subtitle,
      summary,
      slug,
      content,
      category_id,
      tags = [],
      title_style,
      title_image_url,
      is_published,
      published_at,
    } = body;

    // 2. 기존 포스트 조회 (현재 slug 확인)
    const { data: existingPost, error: getError } = await supabase
      .from('posts')
      .select('id, slug')
      .eq('id', id)
      .single();

    if (getError || !existingPost) {
      return NextResponse.json(
        { error: '포스트를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    const oldSlug = existingPost.slug;
    const newSlug = slug;
    const slugChanged = oldSlug !== newSlug;

    // 3. slug가 변경된 경우, 유효성 검사
    if (slugChanged) {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(newSlug)) {
        return NextResponse.json(
          { error: 'slug는 소문자, 숫자, 하이픈만 사용 가능' },
          { status: 400 }
        );
      }

      // 다른 포스트에서 이미 사용 중인 slug인지 확인
      const { data: conflictPost } = await supabase
        .from('posts')
        .select('id')
        .eq('slug', newSlug)
        .neq('id', id)
        .single();

      if (conflictPost) {
        return NextResponse.json(
          { error: '이미 존재하는 slug입니다' },
          { status: 400 }
        );
      }
    }

    // 4. 포스트 업데이트
    const updateData: any = {};
    if (type !== undefined) updateData.type = type;
    if (title !== undefined) updateData.title = title;
    if (subtitle !== undefined) updateData.subtitle = subtitle || null;
    if (summary !== undefined) updateData.summary = summary || null;
    if (slug !== undefined) updateData.slug = slug;
    if (content !== undefined) updateData.content = content;
    if (category_id !== undefined) updateData.category_id = category_id || null;
    if (tags !== undefined) updateData.tags = tags;
    if (title_style !== undefined) updateData.title_style = title_style;
    if (title_image_url !== undefined) updateData.title_image_url = title_image_url || null;
    if (is_published !== undefined) updateData.is_published = is_published;
    if (published_at !== undefined) updateData.published_at = published_at || null;
    updateData.updated_at = new Date().toISOString();

    const { data: updatedPost, error: updateError } = await supabase
      .from('posts')
      .update(updateData)
      .eq('id', id)
      .select()
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

    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

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