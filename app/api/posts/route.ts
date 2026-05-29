// app/api/posts/route.ts

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { revalidateTag } from 'next/cache';
import {
  CACHE_TAGS,
  PUBLIC_API_CACHE_CONTROL,
  getPostsPageData,
} from '@/lib/public-data';

// temp 이미지를 정식 폴더로 이동하는 헬퍼 함수
async function moveImagesToPostFolder(
  supabase: any,
  content: any,
  userId: string,
  postType: string,
  postId: string
): Promise<any> {
  if (!content || !content.content) return content;

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
          .upload(newPath, fileData, { upsert: true });

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
  supabase: any,
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
      .upload(newPath, fileData, { upsert: true });

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
      type = 'blog',
      title,
      subtitle,
      summary,
      slug,
      content,
      category_id,
      tags = [],
      title_style = 'text',
      title_image_url,
      author_id,
      is_published = false,
      published_at,
    } = body;

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

    // 3.5. author_id가 없으면 로그인한 사용자 조회
    let finalAuthorId = author_id;
    if (!finalAuthorId) {
      // 세션에서 사용자 정보 가져오기
      const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
      console.log('User from session:', user?.id, 'Error:', userError);

      if (user) {
        finalAuthorId = user.id;
      }

      // 로그인되지 않았으면 401 반환
      if (!finalAuthorId) {
        return Response.json(
          { error: '로그인이 필요합니다', requiresAuth: true },
          { status: 401 }
        );
      }
    }

    const shouldPublish = Boolean(is_published);
    const finalPublishedAt = shouldPublish
      ? published_at || new Date().toISOString()
      : null;

    // 4. DB에 저장 (먼저 포스트 생성해서 ID 얻기)
    const { data, error } = await supabase
      .from('posts')
      .insert({
        type,
        title,
        subtitle: subtitle || null,
        summary: summary || null,
        slug,
        content,
        category_id: category_id || null,
        tags,
        title_style,
        title_image_url: title_image_url || null,
        author_id: finalAuthorId,
        is_published: shouldPublish,
        published_at: finalPublishedAt,
      })
      .select()
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
      title_image_url || null,
      finalAuthorId,
      type,
      postId
    );

    const postUpdates: Record<string, unknown> = {};
    if (updatedContent !== content) {
      postUpdates.content = updatedContent;
    }
    if (updatedTitleImageUrl !== (title_image_url || null)) {
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
