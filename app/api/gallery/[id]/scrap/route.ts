import { NextRequest, NextResponse } from 'next/server';
import { parsePositiveIntParam } from '@/lib/route-params';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const galleryId = parsePositiveIntParam(id);

  if (!galleryId) {
    return NextResponse.json({ error: 'Invalid gallery id' }, { status: 400 });
  }

  try {
    // 1. 현재 로그인 유저 확인
    const supabaseAuth = await createClient();

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    // 2. Service Role로 DB 작업 (RLS 우회 가능하지만 여기선 로직 처리를 위해 사용)
    const supabase = createAdminClient();

    const { data: gallery, error: galleryError } = await supabase
      .from('gallery')
      .select('id')
      .eq('id', galleryId)
      .maybeSingle();

    if (galleryError || !gallery) {
      return NextResponse.json({ error: 'Gallery not found' }, { status: 404 });
    }

    // 3. 기존 스크랩 확인
    const { data: existingScrap, error: existingScrapError } = await supabase
      .from('gallery_scraps')
      .select('id')
      .eq('gallery_id', galleryId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingScrapError) {
      return NextResponse.json({ error: existingScrapError.message }, { status: 400 });
    }

    let scraped = false;

    if (existingScrap) {
      // 삭제 (스크랩 취소)
      const { error: deleteError } = await supabase
        .from('gallery_scraps')
        .delete()
        .eq('id', existingScrap.id);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 400 });
      }
      scraped = false;
    } else {
      // 추가 (스크랩)
      const { error: insertError } = await supabase.from('gallery_scraps').insert({
        gallery_id: galleryId,
        user_id: user.id,
      });

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 400 });
      }
      scraped = true;
    }

    // 4. 현재 총 스크랩 수 조회 (UI 업데이트용)
    const { count, error: countError } = await supabase
      .from('gallery_scraps')
      .select('id', { count: 'exact', head: true })
      .eq('gallery_id', galleryId);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      scraped,
      scrapCount: count || 0,
    }, {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    });

  } catch (error) {
    console.error('Scrap API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
