// app/api/images/delete/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { id, imageUrl } = await request.json();
    const supabase = await createClient();

    // 1. Storage에서 파일 삭제하기
    // 이미지 URL에서 파일 경로만 추출해야 합니다.
    // 예: .../generated-images/brand_id/timestamp.jpg -> brand_id/timestamp.jpg
    const storagePath = imageUrl.split('/generated-images/').pop();

    if (storagePath) {
      const { error: storageError } = await supabase.storage
        .from('generated-images')
        .remove([storagePath]);
      
      if (storageError) {
        console.error('Storage Delete Error:', storageError);
        // 스토리지 에러가 나도 일단 DB 삭제 시도는 진행합니다.
      }
    }

    // 2. DB에서 데이터 삭제하기
    const { error: dbError } = await supabase
      .from('generated_images')
      .delete()
      .eq('id', id);

    if (dbError) throw dbError;

    return NextResponse.json({ success: true });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}