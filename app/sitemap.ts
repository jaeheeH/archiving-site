import { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSiteSettings } from "@/lib/site-settings";

// 동적 revalidate 설정을 위한 함수
export async function generateStaticParams() {
  const settings = await getSiteSettings();
  return {
    revalidate: settings?.sitemap_revalidate || 3600,
  };
}

export const dynamic = "force-static";
export const revalidate = 3600; // 기본값

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const settings = await getSiteSettings();
  
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://from-archiving.vercel.app";

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