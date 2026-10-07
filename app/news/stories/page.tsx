import { readNews } from "@/lib/news";
import { readNewsPlacement } from "@/lib/news-placement";
import NewsList from "../NewsList";
export default async function StoriesPage({ searchParams }: { searchParams: Promise<{ category?: string; q?: string; source?: string; collection?: string }> }) {
  const params = await searchParams;
  const result = await Promise.all([readNews(), readNewsPlacement()]).catch(() => null);
  if (!result) return <main className="archb-news empty" role="alert"><h1>뉴스를 불러오지 못했습니다.</h1><a href="/news/stories">다시 불러오기</a></main>;
  const [{ articles }, placement] = result;
  return <NewsList articles={articles} editorPickIds={placement.editorPickIds} category={params.category} query={params.q?.slice(0, 100)} source={params.source?.slice(0, 100)} collection={params.collection?.slice(0, 100)} />;
}
