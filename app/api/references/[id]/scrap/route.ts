// app/api/references/[id]/scrap/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { parsePositiveIntParam } from '@/lib/route-params';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const referenceId = parsePositiveIntParam(id);

  if (!referenceId) {
    return NextResponse.json({ error: 'Invalid reference id' }, { status: 400 });
  }

  try {
    // 1️⃣ 현재 사용자 확인
    const supabaseAuth = await createClient();

    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    // 2️⃣ Service Role로 DB 접근
    const supabase = createAdminClient();

    const { data: reference, error: referenceError } = await supabase
      .from('references')
      .select('id')
      .eq('id', referenceId)
      .maybeSingle();

    if (referenceError || !reference) {
      return NextResponse.json({ error: 'Reference not found' }, { status: 404 });
    }

    // 3️⃣ 스크랩 여부 확인
    const { data: existingScrap, error: existingScrapError } = await supabase
      .from('reference_scraps')
      .select('id')
      .eq('reference_id', referenceId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingScrapError) {
      return NextResponse.json({ error: existingScrapError.message }, { status: 400 });
    }

    let scraped = false;
    let scrapCount = 0;

    if (existingScrap) {
      // 4️⃣ 스크랩 취소
      const { error: deleteError } = await supabase
        .from('reference_scraps')
        .delete()
        .eq('id', existingScrap.id);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 400 });
      }
      
      scraped = false;
    } else {
      // 5️⃣ 스크랩 추가
      const { error: insertError } = await supabase
        .from('reference_scraps')
        .insert({
          reference_id: referenceId,
          user_id: user.id,
        });

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 400 });
      }
      
      scraped = true;
    }

    // 6️⃣ 현재 스크랩 개수 조회
    const { count, error: countError } = await supabase
      .from('reference_scraps')
      .select('id', { count: 'exact', head: true })
      .eq('reference_id', referenceId);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 400 });
    }

    scrapCount = count || 0;

    return NextResponse.json(
      {
        success: true,
        scraped,
        scrapCount,
        message: scraped ? '스크랩되었습니다!' : '스크랩이 취소되었습니다.',
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, no-store',
        },
      }
    );
  } catch (error) {
    console.error('❌ 스크랩 API 에러:', error);
    return NextResponse.json(
      { error: '스크랩 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
