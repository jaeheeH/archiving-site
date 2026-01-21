// app/(dashboard)/dashboard/library/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LibraryPage() {
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchImages = async () => {
      const supabase = createClient();
      // 최신순 정렬
      const { data } = await supabase
        .from('generated_images')
        .select(`
          *,
          brands (name)
        `)
        .order('created_at', { ascending: false });
      
      if (data) setImages(data);
      setLoading(false);
    };

    fetchImages();
  }, []);

  if (loading) return <div className="p-8">로딩 중...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Library</h1>
      
      {images.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-lg border-2 border-dashed">
          <p className="text-gray-500">아직 생성된 이미지가 없습니다.</p>
          <a href="/dashboard/studio" className="text-blue-600 hover:underline mt-2 inline-block">
            Studio에서 첫 이미지 만들기 &rarr;
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {images.map((img) => (
            <div key={img.id} className="group relative bg-white rounded-lg shadow-sm overflow-hidden border">
              <div className="aspect-square overflow-hidden bg-gray-100">
                <img 
                  src={img.image_url} 
                  alt={img.prompt} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-4">
                <p className="text-xs text-blue-600 font-medium mb-1">{img.brands?.name}</p>
                <p className="text-sm text-gray-800 line-clamp-2" title={img.prompt}>
                  {img.prompt}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(img.created_at).toLocaleDateString()}
                </p>
              </div>
              {/* 다운로드 버튼 (호버 시 등장) */}
              <a 
                href={img.image_url} 
                download 
                target="_blank"
                className="absolute top-2 right-2 bg-white/90 p-2 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
              >
                💾
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}