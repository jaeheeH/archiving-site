// app/api/brands/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    // [중요] 브랜드 등록은 JSON이 아니라 FormData를 받습니다.
    const formData = await request.formData();
    
    const name = formData.get('name') as string;
    const triggerWord = formData.get('triggerWord') as string;
    const files = formData.getAll('files') as File[];

    const supabase = await createClient();
    
    // 유저 세션 확인 (보안)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. 브랜드 생성 (DB Insert)
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .insert({
        user_id: user.id,
        name,
        trigger_word: triggerWord,
      })
      .select()
      .single();

    if (brandError) {
      console.error('DB Insert Error:', brandError);
      throw brandError;
    }

    // 2. 이미지 업로드 (Storage & DB)
    const uploadPromises = files.map(async (file) => {
      const fileExt = file.name.split('.').pop();
      // 파일명 충돌 방지를 위해 타임스탬프 추가
      const fileName = `${brand.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      // Storage 업로드
      const { error: uploadError } = await supabase.storage
        .from('brand-assets')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // 자산 DB 등록
      return supabase.from('brand_assets').insert({
        brand_id: brand.id,
        storage_path: fileName,
        file_name: file.name
      });
    });

    await Promise.all(uploadPromises);

    return NextResponse.json({ success: true, brandId: brand.id });

  } catch (error: any) {
    console.error('Brand Creation Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}