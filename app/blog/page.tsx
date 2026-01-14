import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import '@/app/css/blog/list.scss';
import BlogClient from './BlogClient';


// ISR 설정: 2시간마다 재생성
export const revalidate = 7200;


// 동적 메타데이터 생성
export async function generateMetadata() {
  return {
    title: 'Insights & Logs',
    description: '개발 과정의 고민과 디자인적 발견을 기록합니다. 프로젝트 비하인드 스토리와 기술적인 인사이트를 공유합니다.',
  };
}

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