import { createClient } from "@/lib/supabase/server";
import HomeGallerySection from "@/app/components/HomeGallerySection";
import HomeBlogSection from "@/app/components/HomeBlogSection";
import PopularBlogs from "@/app/components/PopularBlogs";
import HomeReferenceSectionSlide from "@/app/components/HomeReferenceSectionSlide";
import Link from "next/link";
import "@/app/css/main.scss";

// 1시간마다 페이지 갱신 (ISR 적용)
export const revalidate = 3600;

export default async function Home() {
  const supabase = await createClient();

  // 병렬로 데이터 조회 (Direct DB Access)
  const [blogRes, popularRes, referencesRes, galleryRes, categoriesRes] = await Promise.all([
    // 1. 최신 블로그 글 (최신순 4개)
    supabase
      .from("posts")
      .select("id, title, subtitle, summary, slug, published_at, created_at, title_image_url, category_id, view_count, scrap_count")
      .eq("type", "blog")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(4),
      
    // ✅ 2. 인기 블로그 글 (조회수 높은 순 5개)
    supabase
      .from("posts")
      .select("id, title, slug, view_count, published_at, category_id")
      .eq("type", "blog")
      .eq("is_published", true)
      .order("view_count", { ascending: false }) // 핵심: 조회수 정렬
      .limit(5),

    // 3. 레퍼런스 (최신순 8개)
    supabase
      .from("references")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(8),

    // 4. 갤러리 (최신순 10개)
    supabase
      .from("gallery")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10),

    // 5. 카테고리 정보
    supabase
      .from("categories")
      .select("id, name")
  ]);

  // 데이터 가공 (null 체크)
  const latestBlogs = blogRes.data || [];
  const popularBlogs = popularRes.data || [];
  const references = referencesRes.data || [];
  const gallery = galleryRes.data || [];
  
  // 카테고리 ID -> 이름 매핑 맵 생성
  const categoryMap: Record<string, string> = {};
  if (categoriesRes.data) {
    categoriesRes.data.forEach((cat) => {
      categoryMap[cat.id] = cat.name;
    });
  }

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <div className="contents-padding mx-auto grid lg:grid-col-5">
        <div className="grid lg:grid-cols-4">
          
          {/* 최신 글 */}
          <HomeBlogSection initialPosts={latestBlogs} categories={categoryMap} />
          
          {/* ✅ 인기 글 (이미 정렬된 데이터를 전달) */}
          <PopularBlogs initialPosts={popularBlogs} categories={categoryMap} />

        </div>
      </div>

      {/* References Section */}
      <section className="mainSection mainReferences">
        <div className="contents mx-auto">
          <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">References</h2>
            </div>
            <Link href="/references" className="text-sm font-medium hover:text-gray-600 transition-colors self-start md:self-end">
              View All references &rarr;
            </Link>
          </div>
          <HomeReferenceSectionSlide initialReferences={references} />
        </div>
      </section>

      {/* Gallery Section */}
      <section className="mainSection">
        <div className="contents mx-auto">
          <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Generative Archive</h2>
            </div>
            <Link href="/gallery" className="text-sm font-medium hover:text-gray-600 transition-colors self-start md:self-end">
              View All Gallery &rarr;
            </Link>
          </div>
          <HomeGallerySection initialGallery={gallery} />
        </div>
      </section>
    </main>
  );
}