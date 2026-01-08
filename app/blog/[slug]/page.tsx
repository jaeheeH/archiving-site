// app/blog/[slug]/page.tsx

import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import BlogDetailClient from "./BlogDetailClient";

type Props = {
  params: Promise<{ slug: string }>;
};

// ⚡ ISR 설정: 24시간마다 재검증
export const revalidate = 86400; // 24시간 (86400초)

// 정적 생성할 slug 목록 미리 가져오기
export async function generateStaticParams() {
  try {
    const supabase = await createClient();
    
    const { data: posts, error } = await supabase
      .from('posts')
      .select('slug')
      .eq('is_published', true);

    if (error) {
      console.error('Failed to fetch posts for static generation:', error);
      return [];
    }

    return (posts || []).map((post) => ({
      slug: post.slug,
    }));
  } catch (error) {
    console.error('Error in generateStaticParams:', error);
    return [];
  }
}

// 동적 메타데이터 생성
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("posts")
    .select("title, subtitle, summary, thumbnail_url, title_image_url, tags, updated_at")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (!post) {
    return {
      title: "블로그 글을 찾을 수 없습니다",
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://archbehind.com/";
  const pageUrl = `${baseUrl}/blog/${slug}`;
  
  // thumbnail_url 또는 title_image_url 사용 (우선순위: thumbnail_url > title_image_url)
  const ogImage = post.thumbnail_url || post.title_image_url;

  return {
    title: post.title,
    description: post.summary || post.subtitle || post.title,
    keywords: post.tags || [],
    openGraph: {
      type: "article",
      url: pageUrl,
      title: post.title,
      description: post.summary || post.subtitle || "",
      images: ogImage
        ? [
            {
              url: ogImage,
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
      images: ogImage ? [ogImage] : [],
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;

  const supabase = await createClient();

  // 1️⃣ 현재 slug로 직접 조회
  const { data: post } = await supabase
    .from("posts")
    .select("id, slug")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  // 2️⃣ 없으면 post_slug_history에서 이전 slug 확인
  if (!post) {
    const { data: history } = await supabase
      .from("post_slug_history")
      .select("new_slug, post_id")
      .eq("old_slug", slug)
      .single();

    // 3️⃣ 이전 slug를 찾았으면 새 slug로 리다이렉트 (301)
    if (history && history.new_slug) {
      redirect(`/blog/${history.new_slug}`);
    }

    // 4️⃣ 둘 다 못 찾으면 404
    notFound();
  }

  // 5️⃣ 포스트 존재 확인 완료, 클라이언트 컴포넌트로 렌더링
  return <BlogDetailClient />;
}