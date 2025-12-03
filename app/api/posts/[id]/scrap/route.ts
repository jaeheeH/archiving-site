// app/api/posts/[id]/scrap/route.ts

import { createClient } from '@supabase/supabase-js';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { id } = await params;
  const { action } = await request.json(); // 'add' or 'remove'

  // 사용자 인증 확인
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: '로그인이 필요합니다' }, { status: 401 });
  }

  try {
    if (action === 'add') {
      // 스크랩 추가
      const { error } = await supabase.from('scraps').insert({
        post_id: id,
        user_id: user.id,
      });

      // UNIQUE 제약 위반 (이미 스크랩함)
      if (error?.code === '23505') {
        return Response.json(
          { error: '이미 스크랩했습니다' },
          { status: 400 }
        );
      }

      if (error) {
        return Response.json({ error: error.message }, { status: 400 });
      }

      return Response.json({ success: true, message: '스크랩 완료' });
    } else if (action === 'remove') {
      // 스크랩 제거
      const { error } = await supabase
        .from('scraps')
        .delete()
        .eq('post_id', id)
        .eq('user_id', user.id);

      if (error) {
        return Response.json({ error: error.message }, { status: 400 });
      }

      return Response.json({ success: true, message: '스크랩 취소' });
    }
  } catch (error) {
    return Response.json({ error: '스크랩 처리 실패' }, { status: 500 });
  }
}