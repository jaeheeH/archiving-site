import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import BlogDetailClient from "./BlogDetailClient";

type Props = {
  params: Promise<{ slug: string }>;
};

// ⚡ ISR 설정: 24시간(86400초)마다 페이지 재생성
// 방문자가 들어오면 캐시된 페이지를 보여주고, 24시간이 지났다면 백그라운드에서 최신 데이터로 갱신합니다.
export const revalidate = 86400; 

/**
 * 🛠️ 공통 데이터 페칭 함수
 * generateMetadata와 Page 컴포넌트에서 중복 호출을 줄이고 로직을 통일합니다.
 */
async function getPostData(slug: string) {
  const supabase = await createClient();
  
  // 1️⃣ 현재 슬러그로 포스트 조회
  // '*'로 모든 컬럼을 가져와서 BlogDetailClient에 넘길 준비를 합니다.
  const { data: post } = await supabase
    .from("posts")
    .select("*") 
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (post) {
    return { post, redirectSlug: null };
  }

  // 2️⃣ 포스트가 없다면 slug 변경 이력(history) 확인
  const { data: history } = await supabase
    .from("post_slug_history")
    .select("new_slug")
    .eq("old_slug", slug)
    .single();

  if (history?.new_slug) {
    return { post: null, redirectSlug: history.new_slug };
  }

  // 3️⃣ 둘 다 없으면 null 반환 (404 처리용)
  return null;
}

/**
 * 📦 정적 경로(Static Params) 생성
 * 빌드 시점에 미리 만들어둘 페이지의 slug 목록을 정의합니다.
 */
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

/**
 * 🏷️ 메타데이터 생성 (SEO)
 * 서버에서 미리 데이터를 확인하여 <head> 태그를 완성합니다.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPostData(slug);

  // 데이터가 없거나 리다이렉트가 필요한 경우, 기본값 반환
  if (!data || data.redirectSlug || !data.post) {
    return {
      title: "블로그 글을 찾을 수 없습니다",
    };
  }

  const { post } = data;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://archbehind.com";
  const pageUrl = `${baseUrl}/blog/${slug}`;
  
  // 썸네일 우선순위: thumbnail_url > title_image_url
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
      publishedTime: post.published_at || post.created_at,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.summary || post.subtitle || "",
      images: ogImage ? [ogImage] : [],
    },
  };
}

/**
 * 📄 메인 페이지 컴포넌트 (Server Component)
 */
export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const data = await getPostData(slug);

  // 1️⃣ 데이터가 아예 없으면 404
  if (!data) {
    notFound();
  }
  
  // 2️⃣ 리다이렉트가 필요하면 이동 (307 Temporary or 301 Permanent)
  if (data.redirectSlug) {
    redirect(`/blog/${data.redirectSlug}`);
  }

  // 3️⃣ 정상 데이터가 있으면 Client Component에 'initialPost'로 전달
  // 주의: ISR 환경이므로 로그인한 유저의 scrap 정보(userScraped)는 
  // 여기서 정확히 알 수 없습니다(모두에게 같은 HTML 제공). 
  // 따라서 post 데이터에는 기본적인 내용만 담기고, 
  // 개인화된 정보는 Client Component 내부에서 useEffect로 후처리해야 합니다.
  return <BlogDetailClient initialPost={data.post} />;
}