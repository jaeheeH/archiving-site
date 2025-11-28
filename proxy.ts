import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(req: NextRequest) {
  const { supabase, user, supabaseResponse } = await updateSession(req);
  const { pathname } = req.nextUrl;

  // 1) 로그인 안 되어 있으면 /login으로 이동
  if (!user) {
    if (pathname.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    return supabaseResponse;
  }

  // 2) public.users에서 role 가져오기
  const { data: userRow } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = userRow?.role || 'user';

  // 3) admin, sub-admin은 dashboard 전체 접근 허용
  if (role === 'admin' || role === 'sub-admin') {
    return supabaseResponse;
  }

  // 4) editor 접근 허용 조건
  if (role === 'editor') {
    const allowEditor =
      pathname === '/dashboard' ||
      pathname.startsWith('/dashboard/contents');

    if (!allowEditor) {
      return NextResponse.redirect(new URL('/no-access', req.url));
    }
    return supabaseResponse;
  }

  // 5) user는 dashboard 전체 금지
  if (role === 'user') {
    if (pathname.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/no-access', req.url));
    }
    return supabaseResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/dashboard', '/dashboard/:path*'],
};