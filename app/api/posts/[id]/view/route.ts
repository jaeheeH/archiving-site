// app/api/posts/[id]/view/route.ts

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { id } = await params;
  
  // 사용자 정보
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 세션 ID (비로그인 사용자)
  const cookieStore = await cookies();
  let sessionId = cookieStore.get('sessionId')?.value;

  if (!sessionId && !user) {
    sessionId = crypto.randomUUID();
    // 클라이언트에 쿠키 설정 지시
  }

  try {
    const { error } = await supabase.from('views').insert({
      post_id: id,
      user_id: user?.id || null,
      session_id: user ? null : sessionId,
      user_agent: request.headers.get('user-agent'),
    });

    // UNIQUE 제약 위반 (이미 오늘 봤음) → 무시
    if (error?.code === '23505') {
      return Response.json({ 
        success: true,
        message: '이미 오늘 조회했습니다' 
      });
    }

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ 
      success: true,
      message: '조회가 기록되었습니다' 
    });
  } catch (error) {
    return Response.json(
      { error: '조회 기록 실패' },
      { status: 500 }
    );
  }
}