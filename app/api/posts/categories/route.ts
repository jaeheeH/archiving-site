// app/api/posts/categories/route.ts

import { revalidateTag } from 'next/cache';
import {
  CACHE_TAGS,
  PUBLIC_API_CACHE_CONTROL,
} from '@/lib/public-data';
import { createPublicClient } from '@/lib/supabase/public';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateSlug } from '@/lib/slugify';
import { checkPostEditPermission } from '@/lib/supabase/post-utils';
import { isSafeIdentifierParam } from '@/lib/route-params';

const VALID_CATEGORY_TYPES = new Set(['blog', 'gallery', 'reference']);
const MAX_CATEGORY_NAME_LENGTH = 50;
const CATEGORY_COLUMNS = 'id, name, slug, type, order_index';

function normalizeCategoryType(value: unknown) {
  return typeof value === 'string' && VALID_CATEGORY_TYPES.has(value) ? value : 'blog';
}

function normalizeCategoryName(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, MAX_CATEGORY_NAME_LENGTH);
}

async function parseJsonObject(request: Request) {
  try {
    const parsed = await request.json();
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function revalidateCategoryCaches(type: string) {
  if (type === 'gallery') {
    revalidateTag(CACHE_TAGS.gallery, 'max');
  } else if (type === 'reference') {
    revalidateTag(CACHE_TAGS.references, 'max');
  } else {
    revalidateTag(CACHE_TAGS.posts, 'max');
  }

  revalidateTag(CACHE_TAGS.home, 'max');
}

export async function GET(request: Request) {
  const supabase = createPublicClient();

  const { searchParams } = new URL(request.url);
  const type = normalizeCategoryType(searchParams.get('type'));

  const { data, error } = await supabase
    .from('categories')
    .select(CATEGORY_COLUMNS)
    .eq('type', type)
    .order('order_index', { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json(
    { categories: data },
    {
      headers: {
        'Cache-Control': PUBLIC_API_CACHE_CONTROL,
      },
    }
  );
}

export async function POST(request: Request) {
  try {
    const permCheck = await checkPostEditPermission();
    if (!permCheck.authorized) return permCheck.error;

    const supabase = createAdminClient();

    const body = await parseJsonObject(request);
    if (!body) {
      return Response.json({ error: '잘못된 JSON 요청입니다' }, { status: 400 });
    }

    const { name, type = 'blog' } = body;
    const categoryName = normalizeCategoryName(name);
    const categoryType = normalizeCategoryType(type);

    if (!categoryName) {
      return Response.json({ error: '카테고리 이름이 필요합니다' }, { status: 400 });
    }

    // 최대 order_index 조회
    const { data: categories, error: orderError } = await supabase
      .from('categories')
      .select('order_index')
      .eq('type', categoryType)
      .order('order_index', { ascending: false })
      .limit(1);

    if (orderError) {
      return Response.json({ error: orderError.message }, { status: 400 });
    }

    const maxOrder = categories && categories.length > 0 ? categories[0].order_index : 0;

    // slug 생성 (타임스탬프 포함하여 중복 방지)
    const slug = generateSlug(categoryName, true);

    // 카테고리 생성
    const { data, error } = await supabase
      .from('categories')
      .insert({
        name: categoryName,
        slug,
        type: categoryType,
        order_index: maxOrder + 1,
      })
      .select(CATEGORY_COLUMNS)
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    revalidateCategoryCaches(categoryType);

    return Response.json({ category: data }, { status: 201 });
  } catch (err) {
    console.error('카테고리 생성 실패:', err);
    return Response.json({ error: '서버 오류' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const permCheck = await checkPostEditPermission();
    if (!permCheck.authorized) return permCheck.error;

    const supabase = createAdminClient();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || !isSafeIdentifierParam(id)) {
      return Response.json({ error: '카테고리 ID가 필요합니다' }, { status: 400 });
    }

    // 해당 카테고리를 사용하는 포스트가 있는지 확인
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('type')
      .eq('id', id)
      .maybeSingle();

    if (categoryError) {
      return Response.json({ error: categoryError.message }, { status: 400 });
    }

    if (!category) {
      return Response.json({ error: '카테고리를 찾을 수 없습니다' }, { status: 404 });
    }

    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('id')
      .eq('category_id', id)
      .limit(1);

    if (postsError) {
      return Response.json({ error: postsError.message }, { status: 400 });
    }

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

    revalidateCategoryCaches(category.type || 'blog');

    return Response.json({ message: '카테고리가 삭제되었습니다' }, { status: 200 });
  } catch (err) {
    console.error('카테고리 삭제 실패:', err);
    return Response.json({ error: '서버 오류' }, { status: 500 });
  }
}
