// app/api/revalidate/route.ts

import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // 요청 본문에서 slug 추출
    const { slug } = await request.json();

    // slug 검증
    if (!slug || typeof slug !== 'string') {
      return NextResponse.json(
        { error: 'slug이 필요합니다' },
        { status: 400 }
      );
    }

    // 특정 블로그 글 경로 재검증
    revalidatePath(`/blog/${slug}`);
    
    // 선택사항: 블로그 목록 페이지도 재검증
    revalidatePath('/blog');

    console.log(`✅ 재검증 완료: /blog/${slug}`);

    return NextResponse.json(
      {
        success: true,
        message: `블로그 글 "${slug}"이(가) 재검증되었습니다`,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ 재검증 실패:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: '재검증 중 오류가 발생했습니다',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}