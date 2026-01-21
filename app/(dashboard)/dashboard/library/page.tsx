// app/(dashboard)/dashboard/library/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LibraryPage() {
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 초기 데이터 로딩
  useEffect(() => {
    const fetchImages = async () => {
      const supabase = createClient();
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

  // [추가된 기능] 삭제 핸들러
  const handleDelete = async (id: string, imageUrl: string) => {
    // 1. 사용자 확인
    if (!confirm('정말 이 이미지를 삭제하시겠습니까? (복구 불가)')) return;

    try {
      // 2. 서버에 삭제 요청
      const res = await fetch('/api/images/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, imageUrl }),
      });

      if (!res.ok) throw new Error('삭제 실패');

      // 3. 성공 시 화면에서 즉시 제거 (새로고침 없이)
      setImages((prev) => prev.filter((img) => img.id !== id));
      alert('삭제되었습니다.');

    } catch (error) {
      console.error(error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

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
            <div key={img.id} className="group relative bg-white rounded-lg shadow-sm overflow-hidden border hover:shadow-md transition-shadow">
              
              {/* 이미지 영역 */}
              <div className="aspect-square overflow-hidden bg-gray-100 relative">
                <img 
                  src={img.image_url} 
                  alt={img.prompt} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                
                {/* [추가됨] 버튼 그룹 (호버 시 등장) */}
                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  
                  {/* 다운로드 버튼 */}
                  <a 
                    href={img.image_url} 
                    download 
                    target="_blank"
                    className="bg-white/90 p-2 rounded-full shadow-sm hover:bg-white text-gray-700"
                    title="원본 다운로드"
                  >
                    💾
                  </a>

                  {/* [NEW] 삭제 버튼 */}
                  <button
                    onClick={() => handleDelete(img.id, img.image_url)}
                    className="bg-white/90 p-2 rounded-full shadow-sm hover:bg-red-50 text-red-600"
                    title="영구 삭제"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* 텍스트 정보 */}
              <div className="p-4">
                <p className="text-xs text-blue-600 font-medium mb-1">{img.brands?.name}</p>
                <p className="text-sm text-gray-800 line-clamp-2" title={img.prompt}>
                  {img.prompt}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(img.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}