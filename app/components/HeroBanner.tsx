// components/HeroBanner.tsx
'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  label: string | null;
  image_url: string;
  link: string | null;
  is_continuous: boolean;
  start_date: string | null;
  end_date: string | null;
  order_index: number;
}

export default function HeroBanner() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // 배너 데이터 로드
  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const supabase = createClient();
        const now = new Date().toISOString();

        const { data, error } = await supabase
          .from('banners')
          .select('*')
          .eq('is_active', true)
          .or(
            `is_continuous.eq.true,and(start_date.lte.${now},end_date.gte.${now})`
          )
          .order('order_index', { ascending: true });

        if (error) throw error;
        setBanners(data || []);
      } catch (error) {
        console.error('Failed to fetch banners:', error);
        setBanners([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBanners();
  }, []);

  // 4초마다 자동 슬라이드


  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  };

  if (loading) {
    return (
      <div className="relative lg:w-1/2 bg-gray-200 aspect-[5/4]">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-gray-500">로딩 중...</div>
        </div>
      </div>
    );
  }

  if (banners.length === 0) {
    return null;
  }

  const currentBanner = banners[currentIndex];

  return (
    <div className="relative lg:w-1/2 lg:aspect-[4/3] bg-gray-100 overflow-hidden group">
      {/* 배너 이미지 */}
      <Image
        src={currentBanner.image_url}
        alt={currentBanner.title}
        fill
        className="object-cover"
        priority
        quality={75}
      />

      {/* 어두운 오버레이 */}
      <div className="absolute inset-0 bg-black/30" />

      {/* 배너 콘텐츠 */}
      <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-12 text-white">
        {currentBanner.label && (
          <p className="text-xs md:text-sm font-semibold tracking-widest mb-3 opacity-90">
            {currentBanner.label}
          </p>
        )}

        <h2 className="text-2xl md:text-4xl font-bold mb-2">
          {currentBanner.title}
        </h2>

        {currentBanner.subtitle && (
          <p className="text-sm md:text-base opacity-90 max-w-md">
            {currentBanner.subtitle}
          </p>
        )}
      </div>

      {/* 좌측 화살표 */}
      <button
        onClick={goToPrevious}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/20 hover:bg-white/40 transition text-white opacity-0 group-hover:opacity-100"
        aria-label="Previous banner"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>

      {/* 우측 화살표 */}
      <button
        onClick={goToNext}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/20 hover:bg-white/40 transition text-white opacity-0 group-hover:opacity-100"
        aria-label="Next banner"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>

      {/* 배너 링크 (선택사항) */}
      {currentBanner.link && (
        <Link
          href={currentBanner.link}
          className="absolute inset-0 z-5"
          aria-label={`Go to ${currentBanner.title}`}
        />
      )}
    </div>
  );
}