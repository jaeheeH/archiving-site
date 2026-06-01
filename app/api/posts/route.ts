// app/api/posts/route.ts

import { revalidateTag } from 'next/cache';
import {
  CACHE_TAGS,
  PUBLIC_API_CACHE_CONTROL,
  getPostsPageData,
} from '@/lib/public-data';
import { checkPostEditPermission } from '@/lib/supabase/post-utils';
import { createAdminClient } from '@/lib/supabase/admin';

type TipTapDocument = {
  content?: unknown;
};

const WRITE_POST_COLUMNS =
  'id, type, title, subtitle, summary, slug, content, tags, is_published, published_at, created_at, updated_at, title_style, title_image_url, thumbnail_url, category_id, view_count, scrap_count, author_id';

function hasTipTapContent(value: unknown): value is TipTapDocument {
  return typeof value === "object" && value !== null && "content" in value;
}

async function parseJsonObject(request: Request) {
  try {
    const parsed = await request.json();
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

// temp 이미지를 정식 폴더로 이동하는 헬퍼 함수
async function moveImagesToPostFolder(
  supabase: ReturnType<typeof createAdminClient>,
  content: unknown,
  userId: string,
  postType: string,
  postId: string
): Promise<unknown> {
  if (!hasTipTapContent(content) || !content.content) return content;

  const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace('/v1', '');
  const tempPrefix = `${storageUrl}/storage/v1/object/public/posts/temp/${userId}/`;
  const newPrefix = `${storageUrl}/storage/v1/object/public/posts/${postType}/${postId}/`;

  // content를 문자열로 변환해서 이미지 URL 찾기
  let contentStr = JSON.stringify(content);
  const imageUrls: string[] = [];

  // temp 이미지 URL 추출
  const tempUrlRegex = new RegExp(tempPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^"]+)', 'g');
  let match;
  while ((match = tempUrlRegex.exec(contentStr)) !== null) {
    imageUrls.push(match[1]); // 파일명만 추출
  }

  // 각 이미지를 새 위치로 복사하고 URL 교체
  for (const fileName of imageUrls) {
    const oldPath = `temp/${userId}/${fileName}`;
    const newPath = `${postType}/${postId}/${fileName}`;

    try {
      // 파일 복사 (Supabase는 move가 없어서 copy + delete)
      const { data: fileData } = await supabase.storage
        .from('posts')
        .download(oldPath);

      if (fileData) {
        await supabase.storage
          .from('posts')
          .upload(newPath, fileData, { cacheControl: '31536000', upsert: true });

        // URL 교체
        const oldUrl = `${tempPrefix}${fileName}`;
        const newUrl = `${newPrefix}${fileName}`;
        contentStr = contentStr.replace(new RegExp(oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newUrl);

        // 원본 temp 파일 삭제
        await supabase.storage
          .from('posts')
          .remove([oldPath]);
      }
    } catch (err) {
      console.error(`이미지 이동 실패 (${fileName}):`, err);
      // 에러가 나도 계속 진행
    }
  }

  return JSON.parse(contentStr);
}

async function moveTempPostAssetToPostFolder(
  supabase: ReturnType<typeof createAdminClient>,
  assetUrl: string | null | undefined,
  userId: string,
  postType: string,
  postId: string
): Promise<string | null> {
  if (!assetUrl) return null;

  const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace('/v1', '');
  const tempPrefix = `${storageUrl}/storage/v1/object/public/posts/temp/${userId}/`;
  const newPrefix = `${storageUrl}/storage/v1/object/public/posts/${postType}/${postId}/`;

  if (!assetUrl.startsWith(tempPrefix)) {
    return assetUrl;
  }

  const relativePath = assetUrl.slice(tempPrefix.length).split('?')[0];
  if (!relativePath) return assetUrl;

  const oldPath = `temp/${userId}/${relativePath}`;
  const newPath = `${postType}/${postId}/${relativePath}`;

  try {
    const { data: fileData } = await supabase.storage
      .from('posts')
      .download(oldPath);

    if (!fileData) return assetUrl;

    await supabase.storage
      .from('posts')
      .upload(newPath, fileData, { cacheControl: '31536000', upsert: true });

    await supabase.storage.from('posts').remove([oldPath]);

    return `${newPrefix}${relativePath}`;
  } catch (err) {
    console.error(`대표 이미지 이동 실패 (${relativePath}):`, err);
    return assetUrl;
  }
}

// GET: 포스트 목록 조회
// GET: 포스트 목록 조회
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'blog';
    const limit = parseInt(searchParams.get('limit') || '12', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const categoryId = searchParams.get('category_id'); // 1. 카테고리 ID 추출

    const result = await getPostsPageData(type, limit, offset, categoryId || 'all');

    return Response.json(
      { 
        data: result.data,
        pagination: result.pagination,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': PUBLIC_API_CACHE_CONTROL,
        },
      }
    );
  } catch (err) {
    console.error('API 에러:', err);
    return Response.json({ error: '서버 오류' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const permCheck = await checkPostEditPermission();
    if (!permCheck.authorized) return permCheck.error;

    // DB 작업용 Service Role 클라이언트
    const supabase = createAdminClient();

    // 1. 요청 데이터 받기
    const body = await parseJsonObject(request);
    if (!body) {
      return Response.json({ error: '잘못된 JSON 요청입니다' }, { status: 400 });
    }

    const rawType = typeof body.type === 'string' && body.type.trim() ? body.type.trim() : 'blog';
    if (!/^[a-z0-9_-]{1,40}$/.test(rawType)) {
      return Response.json({ error: '유효하지 않은 포스트 타입입니다' }, { status: 400 });
    }

    const type = rawType;
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const subtitle = typeof body.subtitle === 'string' ? body.subtitle.trim() : null;
    const summary = typeof body.summary === 'string' ? body.summary.trim() : null;
    const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
    const content = body.content;
    const categoryId = typeof body.category_id === 'string' && body.category_id.trim() ? body.category_id.trim() : null;
    const tags = Array.isArray(body.tags)
      ? body.tags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean)
      : [];
    const titleStyle = typeof body.title_style === 'string' && body.title_style.trim() ? body.title_style.trim() : 'text';
    const titleImageUrl = typeof body.title_image_url === 'string' && body.title_image_url.trim()
      ? body.title_image_url.trim()
      : null;
    const publishedAt = typeof body.published_at === 'string' && body.published_at.trim()
      ? body.published_at.trim()
      : null;

    // 2. 필수 데이터 확인
    if (!title || !slug || !content) {
      return Response.json(
        {
          error: '필수 필드가 누락되었습니다',
          required: ['title', 'slug', 'content'],
        },
        { status: 400 }
      );
    }

    // 3. slug 유효성 검사
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      return Response.json(
        { error: 'slug는 소문자, 숫자, 하이픈만 사용 가능' },
        { status: 400 }
      );
    }

    const finalAuthorId = permCheck.userId;

    const shouldPublish = body.is_published === true;
    const finalPublishedAt = shouldPublish
      ? publishedAt || new Date().toISOString()
      : null;

    // 4. DB에 저장 (먼저 포스트 생성해서 ID 얻기)
    const { data, error } = await supabase
      .from('posts')
      .insert({
        type,
        title,
        subtitle,
        summary,
        slug,
        content,
        category_id: categoryId,
        tags,
        title_style: titleStyle,
        title_image_url: titleImageUrl,
        author_id: finalAuthorId,
        is_published: shouldPublish,
        published_at: finalPublishedAt,
      })
      .select(WRITE_POST_COLUMNS)
      .single();

    // 5. 에러 처리
    if (error) {
      // slug 중복 에러
      if (error.code === '23505') {
        return Response.json(
          { error: '이미 존재하는 slug입니다' },
          { status: 400 }
        );
      }
      return Response.json({ error: error.message }, { status: 400 });
    }

    // 5.5. temp 이미지를 정식 폴더로 이동
    const postId = data.id;
    const updatedContent = await moveImagesToPostFolder(
      supabase,
      content,
      finalAuthorId,
      type,
      postId
    );

    const updatedTitleImageUrl = await moveTempPostAssetToPostFolder(
      supabase,
      titleImageUrl,
      finalAuthorId,
      type,
      postId
    );

    const postUpdates: Record<string, unknown> = {};
    if (updatedContent !== content) {
      postUpdates.content = updatedContent;
    }
    if (updatedTitleImageUrl !== titleImageUrl) {
      postUpdates.title_image_url = updatedTitleImageUrl;
    }

    // temp 리소스가 정식 폴더로 이동되었으면 저장된 URL도 갱신
    if (Object.keys(postUpdates).length > 0) {
      await supabase
        .from('posts')
        .update(postUpdates)
        .eq('id', postId);

      if (postUpdates.content) data.content = updatedContent;
      if ('title_image_url' in postUpdates) {
        data.title_image_url = updatedTitleImageUrl;
      }
    }

    revalidateTag(CACHE_TAGS.posts, "max");
    revalidateTag(CACHE_TAGS.home, "max");

    // 6. 성공 응답
    return Response.json(
      {
        message: '포스트가 저장되었습니다',
        data,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('API 에러:', err);
    return Response.json(
      { error: '서버 오류' },
      { status: 500 }
    );
  }
}
