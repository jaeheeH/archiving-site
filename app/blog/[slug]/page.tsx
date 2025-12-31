import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import BlogDetailClient from "./BlogDetailClient";

type Props = {
  params: Promise<{ slug: string }>;
};

// 동적 메타데이터 생성
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("posts")
    .select("title, subtitle, summary, thumbnail_url, tags, updated_at")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (!post) {
    return {
      title: "블로그 글을 찾을 수 없습니다",
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://from-archiving.vercel.app";
  const pageUrl = `${baseUrl}/blog/${slug}`;

  return {
    title: post.title,
    description: post.summary || post.subtitle || post.title,
    keywords: post.tags || [],
    openGraph: {
      type: "article",
      url: pageUrl,
      title: post.title,
      description: post.summary || post.subtitle || "",
      images: post.thumbnail_url
        ? [
            {
              url: post.thumbnail_url,
              width: 1200,
              height: 630,
              alt: post.title,
            },
          ]
        : [],
      publishedTime: post.updated_at,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.summary || post.subtitle || "",
      images: post.thumbnail_url ? [post.thumbnail_url] : [],
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;

  // 서버에서 포스트 존재 여부만 확인
  const supabase = await createClient();
  const { data: post } = await supabase
    .from("posts")
    .select("id")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (!post) {
    notFound();
  }

  // 클라이언트 컴포넌트로 렌더링 위임
  return <BlogDetailClient />;
}