// app/api/admin/posts/route.ts

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// 사용자 권한 정보 조회
async function getUserRole(userId: string, supabase: any) {
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

function applyPostFilters(query: any, params: {
  type: string;
  userRole: string;
  userId: string;
  adminIds: string[];
  categoryId: string | null;
  draftOnly: boolean;
}) {
  let nextQuery = query.eq('type', params.type);

  if (params.userRole === 'sub-admin' && params.adminIds.length > 0) {
    nextQuery = nextQuery.not('author_id', 'in', `(${params.adminIds.join(',')})`);
  } else if (params.userRole === 'editor') {
    nextQuery = nextQuery.eq('author_id', params.userId);
  }

  if (params.categoryId && params.categoryId !== 'all') {
    if (params.categoryId === 'uncategorized') {
      nextQuery = nextQuery.is('category_id', null);
    } else {
      nextQuery = nextQuery.eq('category_id', params.categoryId);
    }
  }

  if (params.draftOnly) {
    nextQuery = nextQuery.eq('is_published', false);
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
    const cookieStore = await cookies();
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

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();

    if (!user) {
      return Response.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    // 2. Service Role 클라이언트로 DB 조회
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

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

    const authorIds = [...new Set((data || []).map((post: any) => post.author_id).filter(Boolean))];
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
      { status: 200 }
    );
  } catch (err) {
    console.error('Admin API 에러:', err);
    return Response.json(
      { error: err instanceof Error ? err.message : '서버 오류' },
      { status: 500 }
    );
  }
}
