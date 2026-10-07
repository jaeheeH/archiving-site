import { readNews } from "@/lib/news";
export async function GET() {
  try { return Response.json(await readNews(), { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } }); }
  catch { return Response.json({ error: "뉴스를 불러오지 못했습니다." }, { status: 503 }); }
}
