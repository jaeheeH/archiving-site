import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const galleryId = parseInt(id); // ID 타입에 맞춰 변환 (number or uuid)

  try {
    // 1. 현재 로그인 유저 확인
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
             try {
               cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
             } catch {}
          },
        },
      }
    );

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    // 2. Service Role로 DB 작업 (RLS 우회 가능하지만 여기선 로직 처리를 위해 사용)
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 3. 기존 스크랩 확인
    const { data: existingScrap } = await supabase
      .from('gallery_scraps')
      .select('id')
      .eq('gallery_id', galleryId)
      .eq('user_id', user.id)
      .maybeSingle();

    let scraped = false;

    if (existingScrap) {
      // 삭제 (스크랩 취소)
      await supabase.from('gallery_scraps').delete().eq('id', existingScrap.id);
      scraped = false;
    } else {
      // 추가 (스크랩)
      await supabase.from('gallery_scraps').insert({
        gallery_id: galleryId,
        user_id: user.id,
      });
      scraped = true;
    }

    // 4. 현재 총 스크랩 수 조회 (UI 업데이트용)
    const { count } = await supabase
      .from('gallery_scraps')
      .select('*', { count: 'exact', head: true })
      .eq('gallery_id', galleryId);

    return NextResponse.json({
      success: true,
      scraped,
      scrapCount: count || 0,
    });

  } catch (error) {
    console.error('Scrap API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}