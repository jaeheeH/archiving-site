"use client";
import HomeGallerySection from "@/app/components/HomeGallerySection";
import HomeBlogSection from "@/app/components/HomeBlogSection";
import HeroBanner from '@/app/components/HeroBanner';
import GalleryRandomSlide from '@/app/components/GalleryRandomSlide';
import PopularBlogs from '@/app/components/PopularBlogs';
import Link from "next/link";

export default function Home() {


  return (
    <main className="min-h-screen ">
      {/* 헤로 섹션 (선택사항) */}
      <section className="pt-12 pb-12 px-4 border-b border-gray-100 animate-fade-in">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-12 lg:gap-20 items-center">
          {/* Left: Typography */}
          <div className="w-full lg:w-1/2 space-y-8">
            <div className="flex items-center gap-3">
              <span className="inline-block px-3 py-1 bg-black text-white text-[10px] font-mono font-bold rounded-full">SYSTEM VER 1.0.2</span>
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            </div>
            <h1 className="lg:text-6xl">
              Archiving <br/> the Behind.
            </h1>
            <p className="text-lg text-gray-500 max-w-md leading-relaxed">
              결과물의 이면을 기록합니다.<br/>
              디자인 영감부터 코드 조각까지, 크리에이터를 위한 구조화된 데이터베이스입니다.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/blog" className="px-6 py-3 bg-black text-white text-sm font-bold rounded-sm hover:bg-gray-800 transition-colors flex items-center gap-2">
                EXPLORE GALLERY
              </Link>
              <button className="px-6 py-3 border border-gray-200 text-sm font-bold rounded-sm hover:border-black transition-colors">
                VIEW BLOG
              </button>
            </div>
            <div className="flex flex-wrap gap-2 pt-4">
              {['#UI/UX', '#NextJS', '#Midjourney', '#Architecture'].map(tag => (
                <span key={tag} className="text-xs text-gray-400 font-mono hover:text-blue-600 cursor-pointer transition-colors border-b border-transparent hover:border-blue-600">{tag}</span>
              ))}
            </div>
          </div>

          {/* Right: Featured Slider */}
          <HeroBanner />
        </div>
      </section>
      <div className="contents mx-auto lg:grid-cols-2">
        {/* 블로그 섹션 */}
        <div className=" grid grid-cols-4 mx-auto py-16 ">
          <HomeBlogSection />
          <div className="pl-12 ">
            <PopularBlogs />
            <GalleryRandomSlide />
          </div>
        </div>
      </div>

        {/* 갤러리 섹션 */}
        <HomeGallerySection />

    </main>
  );
}
