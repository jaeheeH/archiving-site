// app/api/references/[id]/scrap/route.ts

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: referenceId } = await params;

  try {
    // 1️⃣ 현재 사용자 확인
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

    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    // 2️⃣ Service Role로 DB 접근
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 3️⃣ 스크랩 여부 확인
    const { data: existingScrap } = await supabase
      .from('reference_scraps')
      .select('id')
      .eq('reference_id', referenceId)
      .eq('user_id', user.id)
      .maybeSingle();

    let scraped = false;
    let scrapCount = 0;

    if (existingScrap) {
      // 4️⃣ 스크랩 취소
      await supabase
        .from('reference_scraps')
        .delete()
        .eq('id', existingScrap.id);
      
      scraped = false;
    } else {
      // 5️⃣ 스크랩 추가
      await supabase
        .from('reference_scraps')
        .insert({
          reference_id: referenceId,
          user_id: user.id,
        });
      
      scraped = true;
    }

    // 6️⃣ 현재 스크랩 개수 조회
    const { count } = await supabase
      .from('reference_scraps')
      .select('*', { count: 'exact', head: true })
      .eq('reference_id', referenceId);

    scrapCount = count || 0;

    return NextResponse.json(
      {
        success: true,
        scraped,
        scrapCount,
        message: scraped ? '스크랩되었습니다!' : '스크랩이 취소되었습니다.',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ 스크랩 API 에러:', error);
    return NextResponse.json(
      { error: '스크랩 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}