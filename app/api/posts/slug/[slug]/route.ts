// app/api/posts/slug/[slug]/route.ts

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'blog';

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('slug', slug)
      .eq('type', type)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return Response.json({ error: '포스트를 찾을 수 없습니다' }, { status: 404 });
      }
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ data }, { status: 200 });
  } catch (err) {
    console.error('API 에러:', err);
    return Response.json({ error: '서버 오류' }, { status: 500 });
  }
}
