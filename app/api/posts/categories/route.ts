// app/api/posts/categories/route.ts

import { createClient } from '@supabase/supabase-js';
import { generateSlug } from '@/lib/slugify';

export async function GET(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'blog';

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('type', type)
    .order('order_index', { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ categories: data });
}

export async function POST(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await request.json();
    const { name, type = 'blog' } = body;

    if (!name) {
      return Response.json({ error: '카테고리 이름이 필요합니다' }, { status: 400 });
    }

    // 최대 order_index 조회
    const { data: categories } = await supabase
      .from('categories')
      .select('order_index')
      .eq('type', type)
      .order('order_index', { ascending: false })
      .limit(1);

    const maxOrder = categories && categories.length > 0 ? categories[0].order_index : 0;

    // slug 생성 (타임스탬프 포함하여 중복 방지)
    const slug = generateSlug(name, true);

    // 카테고리 생성
    const { data, error } = await supabase
      .from('categories')
      .insert({
        name,
        slug,
        type,
        order_index: maxOrder + 1,
      })
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ category: data }, { status: 201 });
  } catch (err) {
    console.error('카테고리 생성 실패:', err);
    return Response.json({ error: '서버 오류' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return Response.json({ error: '카테고리 ID가 필요합니다' }, { status: 400 });
    }

    // 해당 카테고리를 사용하는 포스트가 있는지 확인
    const { data: posts } = await supabase
      .from('posts')
      .select('id')
      .eq('category_id', id)
      .limit(1);

    if (posts && posts.length > 0) {
      return Response.json(
        { error: '이 카테고리를 사용하는 포스트가 있어 삭제할 수 없습니다' },
        { status: 400 }
      );
    }

    // 카테고리 삭제
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ message: '카테고리가 삭제되었습니다' }, { status: 200 });
  } catch (err) {
    console.error('카테고리 삭제 실패:', err);
    return Response.json({ error: '서버 오류' }, { status: 500 });
  }
}