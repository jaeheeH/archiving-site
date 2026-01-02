// components/GalleryRandomSlide.tsx
'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface GalleryItem {
  id: number;
  title: string;
  image_url: string;
}

export default function GalleryRandomSlide() {
  const [currentItem, setCurrentItem] = useState<GalleryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [allItems, setAllItems] = useState<GalleryItem[]>([]);

  // 갤러리 데이터 로드
  useEffect(() => {
    const fetchGallery = async () => {
      try {
        const supabase = createClient();
        // ✅ 직접 Supabase 조회 (API 거치지 않음)
        const { data, error } = await supabase
          .from('gallery')
          .select('id, title, image_url')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Supabase error:', error);
          throw error;
        }

        setAllItems(data || []);

        // 첫 번째 랜덤 아이템 선택
        if (data && data.length > 0) {
          const randomIndex = Math.floor(Math.random() * data.length);
          setCurrentItem(data[randomIndex]);
        }
      } catch (error) {
        console.error('Failed to fetch gallery:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGallery();
  }, []);

  // 5초마다 랜덤 슬라이드
  useEffect(() => {
    if (allItems.length === 0) return;

    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * allItems.length);
      setCurrentItem(allItems[randomIndex]);
    }, 5000);

    return () => clearInterval(interval);
  }, [allItems]);

  if (loading || !currentItem) {
    return (
      <div className="relative w-full aspect-square bg-gray-200 rounded-2xl overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-gray-500">로딩 중...</div>
        </div>
      </div>
    );
  }

  return (
    <Link href="/gallery">
      <div className="relative w-full aspect-square bg-gray-900 rounded-2xl overflow-hidden group cursor-pointer">
        {/* 배경 이미지 */}
        <Image
          src={currentItem.image_url}
          alt={currentItem.title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          priority
          quality={75}
        />

        {/* 어두운 오버레이 */}
        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors" />

        {/* 콘텐츠 */}
        <div className="absolute inset-0 flex flex-col justify-end p-6 text-white">
          {/* 제목 */}
          <h3 className="text-xl font-bold mb-4 line-clamp-2">
            {currentItem.title}
          </h3>

          {/* 버튼 */}
          <button className="self-start px-6 py-2 bg-white text-black font-semibold rounded-full hover:bg-gray-100 transition">
            보러가기
          </button>
        </div>

        {/* 슬라이드 인디케이터 */}
        <div className="absolute top-4 left-4 right-4 flex gap-1 h-1">
          {allItems.map((item, index) => (
            <div
              key={item.id}
              className={`flex-1 rounded-full transition-opacity ${
                item.id === currentItem.id ? 'bg-white' : 'bg-white/30'
              }`}
            />
          ))}
        </div>
      </div>
    </Link>
  );
}