import { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
// getSiteSettings는 revalidate 설정에 사용할 수 없으므로 sitemap 내부에서 baseUrl 용도로만 사용하거나 제거

// 1. generateStaticParams 제거 (sitemap.ts에서 설정 오버라이드 용도로 작동하지 않음)

// 2. 동적 생성 설정
// 'force-static'을 쓰면 빌드 시점에 생성되고 revalidate 시간만큼 캐시됩니다.
// 실시간성을 원하면 'force-dynamic'으로 변경해야 하지만, 
// 사이트맵은 부하가 크므로 보통 ISR(force-static + revalidate)을 권장합니다.
export const dynamic = "force-static"; 

// 3. 갱신 주기 설정 (초 단위)
// DB에서 가져온 값을 여기에 '변수'로 넣을 수 없습니다. 고정된 숫자를 써야 합니다.
// 테스트 중이라 즉시 갱신이 필요하면 0으로, 평소엔 3600(1시간) or 86400(하루) 추천
export const revalidate = 3600; 

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  // const settings = await getSiteSettings(); // 필요한 경우 사용

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.archbehind.com";

  // 정적 페이지들
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/gallery`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/archive`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  // 갤러리 아이템들
  const { data: galleries } = await supabase
    .from("gallery")
    .select("id, created_at")
    .order("created_at", { ascending: false });

  const galleryPages: MetadataRoute.Sitemap =
    galleries?.map((gallery) => ({
      url: `${baseUrl}/gallery/${gallery.id}`,
      lastModified: new Date(gallery.created_at),
      changeFrequency: "weekly",
      priority: 0.7,
    })) || [];

  // 블로그 포스트들
  const { data: posts } = await supabase
    .from("posts")
    .select("slug, updated_at, type")
    .eq("is_published", true)
    .order("updated_at", { ascending: false });

  const blogPages: MetadataRoute.Sitemap =
    posts?.map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: new Date(post.updated_at),
      changeFrequency: "weekly",
      priority: 0.8,
    })) || [];

  // 아카이빙 아이템들
  const { data: archives } = await supabase
    .from("archiving")
    .select("id, updated_at")
    .order("updated_at", { ascending: false });

  const archivePages: MetadataRoute.Sitemap =
    archives?.map((archive) => ({
      url: `${baseUrl}/archive/${archive.id}`,
      lastModified: new Date(archive.updated_at),
      changeFrequency: "weekly",
      priority: 0.7,
    })) || [];

  return [...staticPages, ...galleryPages, ...blogPages, ...archivePages];
}