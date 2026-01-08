import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import '@/app/css/blog/list.scss';
import BlogClient from './BlogClient';


// ISR 설정: 1시간마다 재생성
export const revalidate = 3600;

export default async function BlogListPage() {
  // ISR은 사용자 세션과 무관하므로 서비스 롤 키를 사용하여 직접 클라이언트를 생성합니다.
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. 초기 포스트 데이터 가져오기
  const { data: posts, count: total, error: postsError } = await supabase
    .from('posts')
    .select('*', { count: 'exact' })
    .eq('type', 'blog')
    .eq('is_published', true)
    .order('published_at', { ascending: false })
    .range(0, 11);

  // 2. 카테고리 데이터 가져오기 (테이블 이름: categories)
  const { data: categories, error: categoriesError } = await supabase
    .from('categories')
    .select('*')
    .eq('type', 'blog') // 블로그 타입만 필터링
    .order('order_index', { ascending: true });

  if (postsError) console.error('Posts Error:', postsError.message);
  if (categoriesError) console.error('Categories Error:', categoriesError.message);

  const initialPagination = {
    total: total || 0,
    limit: 12,
    offset: 0,
    hasMore: (total || 0) > 12,
  };

  return (
    <BlogClient 
      initialPosts={posts || []} 
      categories={categories || []} 
      initialPagination={initialPagination}
    />
  );
}