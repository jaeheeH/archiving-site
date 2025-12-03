// app/api/posts/[id]/route.ts

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';

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

// GET: 포스트 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 404 });
    }

    return Response.json({ data }, { status: 200 });
  } catch (err) {
    console.error('API 에러:', err);
    return Response.json({ error: '서버 오류' }, { status: 500 });
  }
}

// PUT: 포스트 수정
export async function PUT(
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
    const {
      title,
      subtitle,
      summary,
      slug,
      content,
      category_id,
      tags = [],
      title_style = 'text',
      title_image_url,
      is_published,
    } = body;

    // 필수 데이터 확인
    if (!title || !slug || !content) {
      return Response.json(
        {
          error: '필수 필드가 누락되었습니다',
          required: ['title', 'slug', 'content'],
        },
        { status: 400 }
      );
    }

    // slug 유효성 검사
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      return Response.json(
        { error: 'slug는 소문자, 숫자, 하이픈만 사용 가능' },
        { status: 400 }
      );
    }

    // 기존 포스트 조회 (published_at, type, author_id)
    const { data: existingPost } = await supabase
      .from('posts')
      .select('published_at, is_published, type, author_id')
      .eq('id', id)
      .single();

    if (!existingPost) {
      return Response.json(
        { error: '포스트를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // published_at 로직:
    // - 이미 발행된 적 있으면 기존 시간 유지
    // - 처음 발행하는 경우에만 현재 시간 설정
    let published_at = existingPost?.published_at || null;
    if (is_published && !existingPost?.is_published) {
      published_at = new Date().toISOString();
    } else if (!is_published) {
      published_at = null;
    }

    // temp 이미지를 정식 폴더로 이동
    const cookieStore = await cookies();
    const authToken = cookieStore.get('sb-access-token')?.value ||
                      cookieStore.get('sb-127.0.0.1-auth-token')?.value ||
                      cookieStore.get('sb-localhost-auth-token')?.value;

    let userId = existingPost.author_id;
    if (authToken) {
      const { data: { user } } = await supabase.auth.getUser(authToken);
      if (user) {
        userId = user.id;
      }
    }

    const updatedContent = await moveImagesToPostFolder(
      supabase,
      content,
      userId,
      existingPost.type,
      id
    );

    // DB 업데이트
    const { data, error } = await supabase
      .from('posts')
      .update({
        title,
        subtitle: subtitle || null,
        summary: summary || null,
        slug,
        content: updatedContent,
        category_id: category_id || null,
        tags,
        title_style,
        title_image_url: title_image_url || null,
        is_published,
        published_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

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

    return Response.json(
      {
        message: '포스트가 수정되었습니다',
        data,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('API 에러:', err);
    return Response.json({ error: '서버 오류' }, { status: 500 });
  }
}

// DELETE: 포스트 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 먼저 포스트 정보를 가져와서 type 확인
    const { data: post } = await supabase
      .from('posts')
      .select('type')
      .eq('id', id)
      .single();

    // 포스트 삭제
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', id);

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    // 스토리지에서 해당 포스트 폴더 삭제
    if (post?.type) {
      try {
        const folderPath = `${post.type}/${id}`;

        // 폴더 내 모든 파일 목록 가져오기
        const { data: files } = await supabase.storage
          .from('posts')
          .list(folderPath);

        // 파일이 있으면 삭제
        if (files && files.length > 0) {
          const filePaths = files.map(file => `${folderPath}/${file.name}`);
          await supabase.storage
            .from('posts')
            .remove(filePaths);
        }
      } catch (storageError) {
        console.error('스토리지 삭제 실패:', storageError);
        // 스토리지 삭제 실패해도 포스트는 삭제되었으므로 계속 진행
      }
    }

    return Response.json(
      { message: '포스트가 삭제되었습니다' },
      { status: 200 }
    );
  } catch (err) {
    console.error('API 에러:', err);
    return Response.json({ error: '서버 오류' }, { status: 500 });
  }
}
