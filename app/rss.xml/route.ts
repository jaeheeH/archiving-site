import { createRssResponse, getBlogRssXml } from "@/lib/rss";

export const dynamic = "force-static";
export const revalidate = 3600;

export async function GET() {
  const xml = await getBlogRssXml();
  return createRssResponse(xml);
}
