"use client";
import HomeGallerySection from "@/app/components/HomeGallerySection";
import HomeBlogSection from "@/app/components/HomeBlogSection";

export default function Home() {


  return (
    <main className="min-h-screen bg-white">
      {/* 헤로 섹션 (선택사항) */}
      <section className="bg-gradient-to-r from-blue-50 to-indigo-50 py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-4">Archiving</h1>
          <p className="text-xl text-gray-600">
            다양한 디자인과 아이디어를 한곳에 모았습니다.
          </p>
        </div>
      </section>
      <div className="contents mx-auto grid lg:grid-cols-2">

      {/* 블로그 섹션 */}
      <HomeBlogSection />
      {/* 갤러리 섹션 */}
      <HomeGallerySection />
      </div>

    </main>
  );
}
