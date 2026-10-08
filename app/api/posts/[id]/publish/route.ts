// app/api/posts/[id]/publish/route.ts

import { NextRequest } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { CACHE_TAGS } from '@/lib/public-data';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkPostOwnershipOrAdmin } from '@/lib/supabase/post-utils';
import { editorialSchema } from '@/lib/news-editorial';
import { NEWS_FORMAT, completedNewsWriting } from '@/lib/news-record';

// PATCH: 발행 상태만 토글
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const permCheck = await checkPostOwnershipOrAdmin(id);
    if (!permCheck.authorized) return permCheck.error;
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return Response.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 });

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
      .select('published_at, is_published, slug, type, title, summary, tags, content, updated_at')
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

    if (existingPost.type === 'news' && isPublished) {
      const content = existingPost.content;
      if (content?.format !== NEWS_FORMAT || !editorialSchema.safeParse({ url: content.source_url, title: existingPost.title, summary: existingPost.summary, tags: existingPost.tags, paragraphs: content.paragraphs, points: content.points }).success) {
        return Response.json({ error: '뉴스를 한국어 기사로 가공한 후 발행해주세요.' }, { status: 400 });
      }
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
        ...(existingPost.type === 'news' && isPublished && (existingPost.content.automation || existingPost.content.duplicate_review) ? { content: { ...existingPost.content, duplicate_review: undefined, automation: completedNewsWriting(existingPost.content.automation) } } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .filter('updated_at', existingPost.updated_at === null ? 'is' : 'eq', existingPost.updated_at ?? 'null')
      .select('id, slug, type, is_published, published_at, updated_at')
      .maybeSingle();

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (!data) return Response.json({ error: '기사가 변경되었습니다. 새로고침 후 다시 발행해주세요.' }, { status: 409 });

    revalidateTag("archb-news", { expire: 0 });
    revalidatePath("/rss.xml"); revalidatePath("/sitemap.xml");
    revalidateTag(CACHE_TAGS.posts, { expire: 0 });
    revalidateTag(CACHE_TAGS.home, { expire: 0 });
    if (data.type === 'news' || data.type === 'blog') {
      revalidatePath('/'); revalidatePath('/news/stories');
      if (data.slug) revalidatePath(`/news/read/${data.slug}`);
    }
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
