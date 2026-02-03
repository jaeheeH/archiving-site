// app/api/brands/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// 1. 브랜드 목록 가져오기 (기존과 동일)
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
      .from('brands')
      .select(`
        *,
        trained_models (status, created_at)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 2. [변경] 브랜드 생성 (POST) - 트리거 자동 생성
export async function POST(request: Request) {
  try {
    // 이제 trigger_word는 받지 않습니다.
    const { name } = await request.json(); 
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // [핵심] 시스템이 트리거 단어 자동 생성
    // 규칙: "OHJI_" + "랜덤6자리" (예: OHJI_X9Z1A2)
    // 이렇게 하면 전 세계에서 절대 겹칠 일이 없고, AI에게도 매우 유니크한 단어로 인식됩니다.
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const autoTriggerWord = `OHJI_${randomSuffix}`;

    const { data, error } = await supabase
      .from('brands')
      .insert({
        name,
        trigger_word: autoTriggerWord, // 자동 생성된 값 주입
        user_id: user.id
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 3. [변경] 브랜드 수정 (PUT) - 트리거 수정 불가
export async function PUT(request: Request) {
  try {
    // 트리거 단어는 아예 받지도, 수정하지도 않습니다. 오직 이름만!
    const { id, name } = await request.json();
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { error } = await supabase
      .from('brands')
      .update({ name }) // 이름만 수정 가능
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 4. 삭제 (DELETE) - 기존과 동일
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { error } = await supabase
      .from('brands')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}