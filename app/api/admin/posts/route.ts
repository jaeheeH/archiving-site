// app/api/admin/posts/route.ts

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

// 사용자 권한 정보 조회
async function getUserRole(userId: string, supabase: ReturnType<typeof createAdminClient>) {
  const { data, error } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', userId)
    .single();

  if (error || !data) {
    throw new Error('사용자 정보를 조회할 수 없습니다');
  }

  return data.role;
}

function normalizePositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function normalizeOffset(value: string | null) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function normalizeSortField(value: string | null) {
  const allowedFields = ["created_at", "published_at", "view_count", "scrap_count"];
  return value && allowedFields.includes(value) ? value : "created_at";
}

function normalizeSortOrder(value: string | null) {
  return value === "asc" ? "asc" : "desc";
}

type PostFilterableQuery = {
  eq(column: string, value: string | boolean): unknown;
  is(column: string, value: null): unknown;
  not(column: string, operator: string, value: string): unknown;
};

function applyPostFilters<T>(query: T, params: {
  type: string;
  userRole: string;
  userId: string;
  adminIds: string[];
  categoryId: string | null;
  draftOnly: boolean;
}): T {
  let nextQuery = (query as PostFilterableQuery).eq('type', params.type) as T;
  const filterable = () => nextQuery as PostFilterableQuery;

  if (params.userRole === 'sub-admin' && params.adminIds.length > 0) {
    nextQuery = filterable().not('author_id', 'in', `(${params.adminIds.join(',')})`) as T;
  } else if (params.userRole === 'editor') {
    nextQuery = filterable().eq('author_id', params.userId) as T;
  }

  if (params.categoryId && params.categoryId !== 'all') {
    if (params.categoryId === 'uncategorized') {
      nextQuery = filterable().is('category_id', null) as T;
    } else {
      nextQuery = filterable().eq('category_id', params.categoryId) as T;
    }
  }

  if (params.draftOnly) {
    nextQuery = filterable().eq('is_published', false) as T;
  }

  return nextQuery;
}

// GET: 관리자용 포스트 목록 조회 (권한별 필터링)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'blog';
    const limit = normalizePositiveInt(searchParams.get('limit'), 20, 100);
    const offset = normalizeOffset(searchParams.get('offset'));
    const categoryId = searchParams.get('category_id');
    const draftOnly = searchParams.get('draft_only') === 'true';
    const sortBy = normalizeSortField(searchParams.get('sort_by'));
    const sortOrder = normalizeSortOrder(searchParams.get('sort_order'));

    // 1. 현재 사용자 확인
    const supabaseAuth = await createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
      return Response.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    // 2. Service Role 클라이언트로 DB 조회
    const supabase = createAdminClient();

    // 사용자 역할 확인
    const userRole = await getUserRole(user.id, supabase);

    // admin, sub-admin, editor만 접근 가능
    const allowedRoles = ['admin', 'sub-admin', 'editor'];
    if (!allowedRoles.includes(userRole)) {
      return Response.json(
        { error: '접근 권한이 없습니다' },
        { status: 403 }
      );
    }

    let adminIds: string[] = [];

    if (userRole === 'sub-admin') {
      const { data: adminUsers } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'admin');

      if (adminUsers && adminUsers.length > 0) {
        adminIds = adminUsers.map((u) => u.id);
      }
    }

    const filterParams = {
      type,
      userRole,
      userId: user.id,
      adminIds,
      categoryId,
      draftOnly,
    };

    const countQuery = applyPostFilters(
      supabase.from('posts').select('id', { count: 'exact', head: true }),
      filterParams
    );

    const dataQuery = applyPostFilters(
      supabase
        .from('posts')
        .select('id, title, subtitle, summary, slug, is_published, published_at, created_at, updated_at, title_image_url, category_id, view_count, scrap_count, author_id'),
      filterParams
    );

    const { count, error: countError } = await countQuery;
    if (countError) {
      return Response.json(
        { error: countError.message },
        { status: 400 }
      );
    }

    const { data, error } = await dataQuery
      .order(sortBy, { ascending: sortOrder === 'asc', nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return Response.json(
        { error: error.message },
        { status: 400 }
      );
    }

    const authorIds = [...new Set((data || []).map((post: { author_id?: string | null }) => post.author_id).filter(Boolean))];
    const { data: authorRows } = authorIds.length > 0
      ? await supabase.from('users').select('id, role').in('id', authorIds)
      : { data: [] };

    return Response.json(
      {
        data,
        currentUser: {
          id: user.id,
          role: userRole,
        },
        authors: authorRows || [],
        pagination: {
          total: count || 0,
          limit,
          offset,
          hasMore: (offset + limit) < (count || 0)
        }
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, no-store',
        },
      }
    );
  } catch (err) {
    console.error('Admin API 에러:', err);
    return Response.json(
      { error: err instanceof Error ? err.message : '서버 오류' },
      { status: 500 }
    );
  }
}
