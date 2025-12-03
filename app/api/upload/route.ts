import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const fileName = formData.get('fileName') as string;
    const isTemp = formData.get('isTemp') === 'true'; // temp 폴더 사용 여부

    if (!file || !fileName) {
      return NextResponse.json(
        { error: '파일과 파일명이 필요합니다' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 로그인한 사용자 정보 가져오기
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    console.log('Upload API - User:', user?.id, 'Error:', authError);

    // temp 폴더면 user_id별로 (없으면 'anonymous'), 아니면 일반 폴더에 저장
    const userId = user?.id || 'anonymous';
    const filePath = isTemp
      ? `temp/${userId}/${fileName}`
      : fileName;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from('posts')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase 업로드 에러:', uploadError);
      return NextResponse.json(
        { error: '이미지 업로드 실패' },
        { status: 400 }
      );
    }

    const { data } = supabase.storage.from('posts').getPublicUrl(filePath);

    return NextResponse.json(
      { url: data.publicUrl },
      { status: 200 }
    );
  } catch (error) {
    console.error('API 에러:', error);
    return NextResponse.json(
      { error: '서버 오류' },
      { status: 500 }
    );
  }
}