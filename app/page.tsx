import HomeGallerySection from "@/app/components/HomeGallerySection";
import HomeBlogSection from "@/app/components/HomeBlogSection";
import PopularBlogs from "@/app/components/PopularBlogs";
import HomeReferenceSectionSlide from "@/app/components/HomeReferenceSectionSlide";
import Link from "next/link";
import "@/app/css/main.scss";

// 1시간마다 페이지를 새로 빌드 (ISR)
export const revalidate = 3600;

async function getHomeData() {
  // 배포 환경에 따라 도메인 설정 필요 (환경변수 사용 권장)
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  
  try {
    // 병렬 데이터 페칭으로 속도 최적화
    const [
      latestBlogsRes, 
      popularBlogsRes, 
      categoriesRes,
      referencesRes, 
      galleryRes
    ] = await Promise.all([
      // 최신 블로그
      fetch(`${baseUrl}/api/posts?type=blog&limit=4&offset=0`, { next: { revalidate: 3600 } }),
      // 인기 블로그 (view_count 정렬 등은 API 내부 로직 가정)
      // PopularBlogs 컴포넌트 로직에 맞춰 쿼리 파라미터가 필요하다면 API 수정이 필요할 수 있습니다.
      // 기존 PopularBlogs에서는 supabase 직접 호출이었으나, 일관성을 위해 API 호출 혹은 DB 직접 호출로 변경해야 합니다.
      // 여기서는 API 호출 패턴으로 작성합니다.
      fetch(`${baseUrl}/api/posts?type=blog&sort=popular&limit=5`, { next: { revalidate: 3600 } }), 
      // 카테고리 (블로그용)
      fetch(`${baseUrl}/api/posts/categories?type=blog`, { next: { revalidate: 3600 } }),
      // 레퍼런스
      fetch(`${baseUrl}/api/references?page=1&limit=8`, { next: { revalidate: 3600 } }),
      // 갤러리 (랜덤 10개)
      fetch(`${baseUrl}/api/gallery/random?limit=10`, { next: { revalidate: 3600 } }),
    ]);

    const latestBlogsData = latestBlogsRes.ok ? await latestBlogsRes.json() : { data: [] };
    const popularBlogsData = popularBlogsRes.ok ? await popularBlogsRes.json() : { data: [] }; // API 구조에 따라 .data 확인 필요
    const categoriesData = categoriesRes.ok ? await categoriesRes.json() : { categories: [] };
    const referencesData = referencesRes.ok ? await referencesRes.json() : { data: [] };
    const galleryData = galleryRes.ok ? await galleryRes.json() : { data: [] };

    // 카테고리 배열을 Map 형태로 변환 (ID -> Name)
    const categoryMap: Record<string, string> = {};
    if (categoriesData.categories) {
      categoriesData.categories.forEach((cat: any) => {
        categoryMap[cat.id] = cat.name;
      });
    }

    return {
      latestBlogs: latestBlogsData.data || [],
      popularBlogs: popularBlogsData.data || [], // 인기글 API가 data 필드 안에 배열을 준다고 가정
      categoryMap,
      references: referencesData.data || [],
      gallery: galleryData.data || [],
    };

  } catch (error) {
    console.error("Home Data Fetch Error:", error);
    return {
      latestBlogs: [],
      popularBlogs: [],
      categoryMap: {},
      references: [],
      gallery: [],
    };
  }
}

export default async function Home() {
  const { latestBlogs, popularBlogs, categoryMap, references, gallery } = await getHomeData();

  return (
    <main className="min-h-screen">
      {/* 히어로 섹션 */}
      <div className="contents-padding mx-auto grid lg:grid-col-5">
        <div className="grid lg:grid-cols-4">
          <HomeBlogSection initialPosts={latestBlogs} categories={categoryMap} />
          <PopularBlogs initialPosts={popularBlogs} categories={categoryMap} />
        </div>
      </div>

      <section className="mainSection mainReferences">
        <div className="contents mx-auto">
          <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">References</h2>
            </div>
            <Link 
              href="/references" 
              className="text-sm font-medium text-gray-900 pb-0.5 hover:text-gray-600 hover:border-gray-600 transition-colors self-start md:self-end"
            >
              View All references &rarr;
            </Link>
          </div>
          <HomeReferenceSectionSlide initialReferences={references} />
        </div>
      </section>

      {/* 갤러리 섹션 */}
      <section className="mainSection">
        <div className="contents mx-auto">
          <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Generative Archive</h2>
            </div>
            <Link 
              href="/gallery" 
              className="text-sm font-medium text-gray-900 pb-0.5 hover:text-gray-600 hover:border-gray-600 transition-colors self-start md:self-end"
            >
              View All Gallery &rarr;
            </Link>
          </div>
          <HomeGallerySection initialGallery={gallery} />
        </div>
      </section>
    </main>
  );
}