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

// GET: 관리자용 포스트 목록 조회 (권한별 필터링)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'blog';
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

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

    // 3. 권한별 필터링 쿼리 구성
    let query = supabase
      .from('posts')
      .select('id, title, subtitle, summary, slug, is_published, published_at, created_at, updated_at, title_image_url, category_id, view_count, scrap_count, author_id', { count: 'exact' })
      .eq('type', type);

    // admin은 모든 글, sub-admin은 admin 제외, editor는 자신의 글만
    if (userRole === 'sub-admin') {
      // admin이 작성한 글 제외
      const { data: adminUsers } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'admin');

      if (adminUsers && adminUsers.length > 0) {
        const adminIds = adminUsers.map((u) => u.id);
        query = query.not('author_id', 'in', `(${adminIds.join(',')})`);
      }
    } else if (userRole === 'editor') {
      // 자신의 글만
      query = query.eq('author_id', user.id);
    }
    // admin은 필터링 없음

    // 4. 전체 개수 조회
    const { count } = await query;

    // 5. 페이지네이션된 데이터 조회
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return Response.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return Response.json(
      {
        data,
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