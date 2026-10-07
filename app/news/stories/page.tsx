import { readNews } from "@/lib/news";
import { readNewsPlacement } from "@/lib/news-placement";
import NewsList from "../NewsList";
import { CATEGORIES } from '@/lib/news-feeds';
import { pageMetadata } from '@/lib/seo';
type Search = { category?: string; q?: string; source?: string; collection?: string };
export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const category = params.category && Object.hasOwn(CATEGORIES, params.category) ? params.category as keyof typeof CATEGORIES : null;
  return pageMetadata({ path: `/news/stories${category ? `?category=${category}` : ''}`, title: category ? `${CATEGORIES[category]} 뉴스` : '뉴스', description: '디자인·AI·제품·개발·인테리어의 소식과 ARCH.B 에디토리얼을 함께 읽습니다.', noindex: !!(params.q?.trim() || params.source || params.collection) });
}
export default async function StoriesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const result = await Promise.all([readNews(), readNewsPlacement()]).catch(() => null);
  if (!result) return <main className="archb-news empty" role="alert"><h1>뉴스를 불러오지 못했습니다.</h1><a href="/news/stories">다시 불러오기</a></main>;
  const [{ articles }, placement] = result;
  return <NewsList articles={articles} editorPickIds={placement.editorPickIds} category={params.category} query={params.q?.slice(0, 100)} source={params.source?.slice(0, 100)} collection={params.collection?.slice(0, 100)} />;
}
