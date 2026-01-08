'use client';

import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  Menu, 
  Search, 
  Bookmark, 
  ChevronRight,
  Clock,
  ArrowUpRight,
  Grid,
  List
} from 'lucide-react';

export default function ArchBMagazine() {
  const [scrolled, setScrolled] = useState(false);

  // Scroll detection for sticky header styling
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white text-[#111] font-sans selection:bg-[#ff4800] selection:text-white">
      
      {/* ─────────────────────────────────────────────────────────────
          1. TOP TICKER & HEADER
          - Design.co.kr 스타일의 뉴스 티커와 견고한 헤더
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-black text-white text-[10px] md:text-xs py-2 px-4 overflow-hidden whitespace-nowrap border-b border-gray-800">
        <div className="inline-block animate-marquee">
          <span className="mx-4">Running text content for latest updates...</span>
          <span className="mx-4 text-[#ff4800] font-bold">NEW ISSUE</span> 
          ARCH-B MAGAZINE VOL.24 : 'THE NEW STANDARD' RELEASED 
          <span className="mx-4 text-gray-500">|</span> 
          <span className="mx-4">TRENDING</span> 
          2026 INTERIOR MATERIAL REPORT 
          <span className="mx-4 text-gray-500">|</span> 
          <span className="mx-4">EVENT</span> 
          SEOUL DESIGN WEEK RECAP
        </div>
      </div>

      <nav className={`sticky top-0 z-50 w-full transition-all duration-300 border-b border-gray-200 bg-white/95 backdrop-blur-sm ${scrolled ? 'py-3' : 'py-5'}`}>
        <div className="max-w-[1600px] mx-auto px-6 flex justify-between items-center">
          {/* Left: Menu & Search */}
          <div className="flex gap-4 items-center w-1/4">
            <Menu className="w-6 h-6 cursor-pointer hover:text-[#ff4800] transition-colors" />
            <Search className="w-5 h-5 cursor-pointer hover:text-[#ff4800] transition-colors" />
          </div>

          {/* Center: Logo */}
          <div className="text-center w-2/4">
            <h1 className="text-3xl md:text-4xl font-serif font-black tracking-tighter cursor-pointer">
              ARCH-B
            </h1>
          </div>

          {/* Right: Util */}
          <div className="flex justify-end items-center gap-6 w-1/4 text-xs font-bold tracking-widest">
            <span className="hidden md:block cursor-pointer hover:underline">SUBSCRIBE</span>
            <span className="hidden md:block cursor-pointer hover:underline">LOGIN</span>
            <span className="md:hidden block">MY</span>
          </div>
        </div>
      </nav>

      {/* ─────────────────────────────────────────────────────────────
          2. COVER STORY (MAGAZINE SPREAD)
          - 잡지 펼침면 같은 레이아웃 (텍스트 + 대형 이미지)
      ───────────────────────────────────────────────────────────── */}


      {/* ─────────────────────────────────────────────────────────────
          3. FEATURED & NEWS (DESIGN.CO.KR STYLE)
          - 좌측: 비주얼 아티클 / 우측: 리스트형 뉴스
      ───────────────────────────────────────────────────────────── */}
      <section className="max-w-[1280px] mx-auto border-b border-gray-200">
        <div className="grid grid-cols-1 lg:grid-cols-4">
          
          {/* Left: Featured Visual (2 cols) */}
          <div className="lg:col-span-3 border-r border-gray-200">
            {/* Horizontal Long Article */}
            <article className="p-8 flex flex-col md:flex-row gap-8 items-center cursor-pointer group hover:bg-gray-50">
               <div className="w-full md:w-1/2 aspect-video overflow-hidden bg-gray-200">
                  <img src="https://images.unsplash.com/photo-1505567745926-ba89000d255a?q=80&w=1600&auto=format&fit=crop" className="w-full h-full object-cover" alt="Article 3"/>
               </div>
               <div className="w-full md:w-1/2">
                 <span className="border border-black px-2 py-1 text-[10px] font-bold uppercase mb-3 inline-block">Editor's Pick</span>
                 <h3 className="text-2xl md:text-3xl font-serif mb-4 leading-tight group-hover:text-[#ff4800] transition-colors">
                   The Future of <br/>Sustainable Office
                 </h3>
                 <p className="text-sm text-gray-600 mb-4">
                   펜데믹 이후, 오피스는 단순히 일하는 공간이 아닙니다. 친환경과 웰니스(Wellness)가 결합된 2026년형 오피스 가이드.
                 </p>
                 <span className="text-xs font-bold underline">READ MORE</span>
               </div>
            </article>
            <div className="grid grid-cols-1 md:grid-cols-3">
            <article className="group border-r border-b border-gray-200 p-8 hover:bg-gray-50 transition-colors cursor-pointer h-full">
                <div className="aspect-[4/3] overflow-hidden mb-6 bg-gray-200">
                  <img src="https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=1600&auto=format&fit=crop" className="w-full h-full object-cover" alt="Article 1"/>
                </div>
                <span className="text-[#ff4800] text-xs font-bold uppercase mb-2 block">Interior</span>
                <h3 className="text-2xl font-serif mb-3 group-hover:underline decoration-1 underline-offset-4">Minimalism is Dead?</h3>
                <p className="text-sm text-gray-500 line-clamp-2">맥시멀리즘의 귀환. 이제는 비우는 것보다 어떻게 채우느냐가 공간의 품격을 결정합니다.</p>
              </article>
              <article className="group border-r border-b border-gray-200 p-8 hover:bg-gray-50 transition-colors cursor-pointer h-full">
                <div className="aspect-[4/3] overflow-hidden mb-6 bg-gray-200">
                  <img src="https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=1600&auto=format&fit=crop" className="w-full h-full object-cover" alt="Article 1"/>
                </div>
                <span className="text-[#ff4800] text-xs font-bold uppercase mb-2 block">Interior</span>
                <h3 className="text-2xl font-serif mb-3 group-hover:underline decoration-1 underline-offset-4">Minimalism is Dead?</h3>
                <p className="text-sm text-gray-500 line-clamp-2">맥시멀리즘의 귀환. 이제는 비우는 것보다 어떻게 채우느냐가 공간의 품격을 결정합니다.</p>
              </article>
              <article className="group border-b border-gray-200 p-8 hover:bg-gray-50 transition-colors cursor-pointer h-full">
                <div className="aspect-[4/3] overflow-hidden mb-6 bg-gray-200">
                   <img src="https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?q=80&w=1600&auto=format&fit=crop" className="w-full h-full object-cover" alt="Article 2"/>
                </div>
                <span className="text-[#ff4800] text-xs font-bold uppercase mb-2 block">Tech</span>
                <h3 className="text-2xl font-serif mb-3 group-hover:underline decoration-1 underline-offset-4">AI in Architecture</h3>
                <p className="text-sm text-gray-500 line-clamp-2">생성형 AI가 건축 설계 프로세스를 어떻게 바꾸고 있는가. 현직 아키텍트 5인의 대담.</p>
              </article>

              

            </div>
            

          </div>

          {/* Right: List News (1 col) - Design.co.kr Style */}
          <div className="lg:col-span-1 bg-white">
            <div className="p-6 border-b border-black bg-black text-white flex justify-between items-center">
              <h4 className="font-bold text-lg">TODAY'S NEWS</h4>
              <Clock className="w-4 h-4 text-[#ff4800]" />
            </div>
            <ul className="divide-y divide-gray-200">
              {[1, 2, 3, 4, 5, 6].map((item, i) => (
                <li key={i} className="p-4 hover:bg-gray-50 cursor-pointer group transition-colors">
                  <div className="flex gap-4 items-start">
                    <span className="text-xs font-mono text-[#ff4800] mt-1">0{i + 1}</span>
                    <div>
                      <h5 className="font-medium text-base leading-snug mb-2 group-hover:underline decoration-1 underline-offset-4">
                        {[
                          "프리츠커상 수상자 발표: 올해의 주인공은?",
                          "서울시, 한강변 35층 룰 폐지 확정",
                          "애플, 새로운 혼합현실 헤드셋 디자인 공개",
                          "성수동 팝업스토어, 이제는 '지속가능성'이 화두",
                          "디자이너가 꼭 알아야 할 2026 컬러 트렌드",
                          "국립현대미술관, '올해의 작가상' 전시 오픈"
                        ][i]}
                      </h5>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                        {[
                          "Architecture", "Policy", "Tech", "Culture", "Design", "Exhibition"
                        ][i]} • 2h ago
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="p-4 text-center border-t border-gray-200">
              <button className="text-xs font-bold uppercase hover:text-[#ff4800]">View All News +</button>
            </div>
          </div>
        </div>
      </section>


      {/* ─────────────────────────────────────────────────────────────
          4. CAMPAIGN / PT (29CM STYLE)
          - 가로 스크롤이 아닌, 섹션별로 끊어지는 대형 비주얼 스토리텔링
      ───────────────────────────────────────────────────────────── */}
      <section className="py-24 bg-[#1a1a1a] text-white">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="flex justify-between items-end mb-16 border-b border-white/20 pb-6">
            <div>
              <span className="text-[#ff4800] font-bold tracking-widest text-xs mb-2 block">SPECIAL CAMPAIGN</span>
              <h2 className="text-4xl md:text-5xl font-serif">Brand Focus</h2>
            </div>
            <div className="hidden md:block text-right">
              <p className="text-sm text-gray-400">브랜드의 철학을 깊이 있게 탐구합니다.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            {/* Campaign 1 */}
            <div className="group cursor-pointer">
              <div className="relative aspect-[3/4] overflow-hidden mb-6 bg-gray-800">
                <img 
                   src="https://images.unsplash.com/photo-1595515106967-14375b66d143?q=80&w=1600&auto=format&fit=crop" 
                   className="w-full h-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-105"
                   alt="Campaign 1"
                />
                <div className="absolute top-4 left-4">
                  <span className="bg-white text-black text-[10px] font-bold px-2 py-1 uppercase">Promotion</span>
                </div>
                <div className="absolute bottom-6 left-6 right-6 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                  <span className="inline-flex items-center gap-2 bg-[#ff4800] text-white text-xs font-bold px-4 py-2 rounded-full">
                    View Campaign <ArrowRight className="w-3 h-3"/>
                  </span>
                </div>
              </div>
              <h3 className="text-3xl font-serif italic mb-2">Herman Miller</h3>
              <p className="text-gray-400 text-sm leading-relaxed max-w-md">
                "디자인은 문제를 해결하는 것이다." 허먼밀러가 정의하는 
                완벽한 의자의 조건, 그리고 인체공학의 미학.
              </p>
            </div>

            {/* Campaign 2 */}
            <div className="group cursor-pointer md:mt-24"> {/* 엇박자 레이아웃 */}
              <div className="relative aspect-[3/4] overflow-hidden mb-6 bg-gray-800">
                <img 
                   src="https://images.unsplash.com/photo-1598928506311-c55ded91a20c?q=80&w=1600&auto=format&fit=crop" 
                   className="w-full h-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-105"
                   alt="Campaign 2"
                />
                 <div className="absolute top-4 left-4">
                  <span className="bg-white text-black text-[10px] font-bold px-2 py-1 uppercase">Spotlight</span>
                </div>
                 <div className="absolute bottom-6 left-6 right-6 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                  <span className="inline-flex items-center gap-2 bg-[#ff4800] text-white text-xs font-bold px-4 py-2 rounded-full">
                    View Campaign <ArrowRight className="w-3 h-3"/>
                  </span>
                </div>
              </div>
              <h3 className="text-3xl font-serif italic mb-2">Aesop's Space</h3>
              <p className="text-gray-400 text-sm leading-relaxed max-w-md">
                이솝이 도시마다 다른 매장을 짓는 이유. 
                지역의 문화를 흡수하여 브랜드의 언어로 재해석하다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. REFERENCE & SHOP (GRID CATALOG)
          - 깔끔한 격자형 디자인, 호버 시 기능성 아이콘 노출
      ───────────────────────────────────────────────────────────── */}
      <section className="py-24 max-w-[1600px] mx-auto px-6">
        <div className="flex justify-between items-center mb-12">
           <h2 className="text-3xl md:text-4xl font-serif font-bold">
            Curated Reference
          </h2>
          <div className="flex gap-4">
             <button className="p-2 border border-gray-200 hover:bg-black hover:text-white transition-colors"><Grid className="w-4 h-4"/></button>
             <button className="p-2 border border-gray-200 hover:bg-black hover:text-white transition-colors"><List className="w-4 h-4"/></button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-12">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((item, i) => (
            <div key={i} className="group cursor-pointer">
              <div className="relative aspect-square bg-[#f0f0f0] mb-4 overflow-hidden">
                <img 
                  src={`https://source.unsplash.com/random/800x800?object,${i}`} 
                  className="w-full h-full object-cover mix-blend-multiply transition-transform duration-500 group-hover:scale-110"
                  onError={(e) => {
                    e.currentTarget.src = `https://images.unsplash.com/photo-1586023492125-27b2c045efd7?q=80&w=800&auto=format&fit=crop`;
                  }}
                  alt="Product"
                />
                <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button className="bg-white p-2 rounded-full shadow-md hover:bg-[#ff4800] hover:text-white"><Bookmark className="w-4 h-4"/></button>
                   <button className="bg-white p-2 rounded-full shadow-md hover:bg-[#ff4800] hover:text-white"><ArrowUpRight className="w-4 h-4"/></button>
                </div>
              </div>
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-sm mb-1">Object No. {204 + i}</h4>
                  <p className="text-xs text-gray-500">Vitra Design Museum</p>
                </div>
                <span className="text-xs font-bold border border-black px-1">REF</span>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-20 flex justify-center">
          <button className="px-12 py-4 border border-black text-sm font-bold uppercase hover:bg-black hover:text-white transition-all tracking-widest">
            View All Database
          </button>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          6. FOOTER
          - 대형 타이포그래피 푸터
      ───────────────────────────────────────────────────────────── */}
      <footer className="bg-black text-white pt-24 pb-12 px-6">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start mb-24 gap-12">
            <div>
              <h2 className="text-6xl md:text-9xl font-serif font-black tracking-tighter mb-8 leading-none">
                ARCH-B
              </h2>
              <p className="max-w-md text-gray-400 font-light">
                We archive the behind scenes of creativity. <br/>
                From initial sketches to final codes.
              </p>
            </div>
            <div className="flex gap-12 md:gap-24 text-sm font-bold tracking-wider">
               <ul className="space-y-4">
                 <li className="text-gray-500 mb-2">SECTIONS</li>
                 <li className="hover:text-[#ff4800] cursor-pointer">Editorial</li>
                 <li className="hover:text-[#ff4800] cursor-pointer">News</li>
                 <li className="hover:text-[#ff4800] cursor-pointer">Campaign</li>
                 <li className="hover:text-[#ff4800] cursor-pointer">Reference</li>
               </ul>
               <ul className="space-y-4">
                 <li className="text-gray-500 mb-2">SOCIAL</li>
                 <li className="hover:text-[#ff4800] cursor-pointer">Instagram</li>
                 <li className="hover:text-[#ff4800] cursor-pointer">Youtube</li>
                 <li className="hover:text-[#ff4800] cursor-pointer">LinkedIn</li>
               </ul>
               <ul className="space-y-4">
                 <li className="text-gray-500 mb-2">COMPANY</li>
                 <li className="hover:text-[#ff4800] cursor-pointer">About Us</li>
                 <li className="hover:text-[#ff4800] cursor-pointer">Careers</li>
                 <li className="hover:text-[#ff4800] cursor-pointer">Contact</li>
               </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between text-xs text-gray-500">
             <p>© 2026 ARCH-B Inc. All rights reserved.</p>
             <div className="flex gap-6 mt-4 md:mt-0">
               <span className="cursor-pointer hover:text-white">Privacy Policy</span>
               <span className="cursor-pointer hover:text-white">Terms of Use</span>
             </div>
          </div>
        </div>
      </footer>
    </div>
  );
}