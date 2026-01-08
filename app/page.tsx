"use client";
import HomeGallerySection from "@/app/components/HomeGallerySection";
import HomeBlogSection from "@/app/components/HomeBlogSection";
import GalleryRandomSlide from '@/app/components/GalleryRandomSlide';
import PopularBlogs from '@/app/components/PopularBlogs';
import HomeReferenceSectionSlide from "@/app/components/HomeReferenceSectionSlide";
import Link from "next/link";
import "@/app/css/main.scss";

export default function Home() {


  return (
    <main className="min-h-screen ">
      {/* 헤로 섹션 (선택사항) */}
      <div className="contents-padding mx-auto grid lg:grid-col-5">
        <div className="grid lg:grid-cols-4">
          <HomeBlogSection />
          <PopularBlogs />
          {/* <GalleryRandomSlide /> */}
        </div>
      </div>
      <section className="contents mx-auto pt-20 mainSection">
        <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">
            References
            </h2>
          </div>
          {/* 더보기 버튼 (선택 사항) */}
          <a href="/references" className="text-sm font-medium text-gray-900  pb-0.5 hover:text-gray-600 hover:border-gray-600 transition-colors self-start md:self-end">
            View All references &rarr;
          </a>
        </div>
        <HomeReferenceSectionSlide />
      </section>
      {/* 갤러리 섹션 */}
      <section className="contents mx-auto py-20 mainSection">
        <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">
              Generative Archive
            </h2>
          </div>
          {/* 더보기 버튼 (선택 사항) */}
          <a href="/gallery" className="text-sm font-medium text-gray-900pb-0.5 hover:text-gray-600 hover:border-gray-600 transition-colors self-start md:self-end">
            View All Gallery &rarr;
          </a>
        </div>
        <HomeGallerySection />
      </section>
    </main>
  );
}
