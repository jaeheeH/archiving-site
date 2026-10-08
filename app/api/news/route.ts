import { readNews, readNewsSummaries } from "@/lib/news";
import { newsPage } from '@/lib/news-list';
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const result = params.get('view') === 'list' ? newsPage((await readNewsSummaries()).articles, Object.fromEntries(params)) : await readNews();
    return Response.json(result, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } });
  }
  catch { return Response.json({ error: "뉴스를 불러오지 못했습니다." }, { status: 503 }); }
}
