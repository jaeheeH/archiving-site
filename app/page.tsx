import HomeGallerySection from "@/app/components/HomeGallerySection";
import HomeBlogSection from "@/app/components/HomeBlogSection";
import PopularBlogs from "@/app/components/PopularBlogs";
import HomeReferenceSectionSlide from "@/app/components/HomeReferenceSectionSlide";
import Link from "next/link";
import { getHomeData } from "@/lib/public-data";
import "@/app/css/main.scss";

// 1시간마다 페이지 갱신 (ISR 적용)
export const revalidate = 3600;

export default async function Home() {
  const { latestBlogs, popularBlogs, references, gallery, categories } =
    await getHomeData();

  return (
    <main className="archive-home min-h-screen">
      {/* Hero Section */}
      <div className="contents-padding mx-auto grid lg:grid-col-5">
        <div className="grid lg:grid-cols-4">
          
          {/* 최신 글 */}
          <HomeBlogSection initialPosts={latestBlogs} categories={categories} />
          
          {/* ✅ 인기 글 (이미 정렬된 데이터를 전달) */}
          <PopularBlogs initialPosts={popularBlogs} categories={categories} />

        </div>
      </div>

      {/* References Section */}
      <section className="mainSection mainReferences">
        <div className="contents mx-auto">
          <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">References</h2>
            </div>
            <Link href="/references" className="self-start text-sm font-medium transition-colors hover:text-[#ff4800] md:self-end">
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
            <Link href="/gallery" className="self-start text-sm font-medium transition-colors hover:text-[#ff4800] md:self-end">
              View All Gallery &rarr;
            </Link>
          </div>
          <HomeGallerySection initialGallery={gallery} />
        </div>
      </section>
    </main>
  );
}
