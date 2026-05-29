// app/api/images/delete/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const { id } = await request.json();
    const supabaseAuth = await createClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    if (!id) {
      return NextResponse.json({ error: '이미지 ID가 필요합니다.' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: image, error: imageError } = await supabase
      .from('generated_images')
      .select('id, image_url, user_id')
      .eq('id', id)
      .maybeSingle();

    if (imageError) throw imageError;

    if (!image) {
      return NextResponse.json({ error: '이미지를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (image.user_id !== user.id) {
      return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 });
    }

    // 1. Storage에서 파일 삭제하기
    // 이미지 URL에서 파일 경로만 추출해야 합니다.
    // 예: .../generated-images/brand_id/timestamp.jpg -> brand_id/timestamp.jpg
    const storagePath = image.image_url.split('/generated-images/').pop();

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
      .eq('id', id)
      .eq('user_id', user.id);

    if (dbError) throw dbError;

    return NextResponse.json({ success: true });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
