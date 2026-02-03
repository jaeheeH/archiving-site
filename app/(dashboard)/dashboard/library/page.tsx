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
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('generated_images')
        .select(`
          *,
          brands!inner (name, user_id)
        `)
        .eq('brands.user_id', user.id) 
        .order('created_at', { ascending: false });
      
      if (data) setImages(data);
      setLoading(false);
    };

    fetchImages();
  }, []);

  const handleDelete = async (id: string, imageUrl: string) => {
    if (!confirm('정말 이 이미지를 삭제하시겠습니까? (복구 불가)')) return;

    try {
      const res = await fetch('/api/images/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, imageUrl }),
      });

      if (!res.ok) throw new Error('삭제 실패');
      setImages((prev) => prev.filter((img) => img.id !== id));
      alert('삭제되었습니다.');
    } catch (error) {
      console.error(error);
      alert('오류가 발생했습니다.');
    }
  };

  const handleCopySeed = (seed: number) => {
    navigator.clipboard.writeText(String(seed));
    alert(`시드값(${seed})이 복사되었습니다!`);
  };

  if (loading) return <div className="p-8">로딩 중...</div>;

  return (
    <div className="flex-1 bg-gray-50 dashboard-Contents">  
      <div className='dashboard-container'>
      <h1 className="text-2xl font-bold mb-6">Library</h1>

      {images.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-lg border-2 border-dashed">
          <p className="text-gray-500">아직 생성된 이미지가 없습니다.</p>
          <a href="/dashboard/studio" className="text-blue-600 hover:underline mt-2 inline-block">
            Studio에서 첫 이미지 만들기 &rarr;
          </a>
        </div>
      ) : (
        /* [변경] Grid 대신 Columns 사용 (Masonry Layout) */
        <div className="columns-2 md:columns-3 lg:columns-6 gap-4 space-y-4">
          {images.map((img) => (
            /* [변경] break-inside-avoid: 컬럼 중간에 잘림 방지, mb-4: 아래 간격 */
            <div key={img.id} className="break-inside-avoid mb-4 group relative bg-white rounded-lg shadow-sm border hover:shadow-md transition-all">
              
              {/* 이미지 영역 (비율 제한 없음) */}
              <div className="relative overflow-hidden rounded-t-lg">
                {/* [변경] aspect-square 제거, w-full h-auto로 본연의 비율 유지 */}
                <img 
                  src={img.image_url} 
                  alt={img.prompt} 
                  className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
                />
                
                {/* 우상단 버튼 (다운로드, 삭제) */}
                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <a 
                    href={img.image_url} 
                    download 
                    target="_blank"
                    className="bg-white/90 p-2 rounded-full shadow-sm hover:bg-white text-gray-700 transition-colors"
                    title="원본 다운로드"
                  >
                    💾
                  </a>
                  <button
                    onClick={() => handleDelete(img.id, img.image_url)}
                    className="bg-white/90 p-2 rounded-full shadow-sm hover:bg-red-50 text-red-600 transition-colors"
                    title="영구 삭제"
                  >
                    🗑️
                  </button>
                </div>

                {/* 좌하단 비율 뱃지 */}
                <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   <span className="bg-black/60 text-white text-[10px] px-2 py-1 rounded-full backdrop-blur-sm font-medium">
                     {img.aspect_ratio || '1:1'}
                   </span>
                </div>
              </div>

              {/* 텍스트 정보 */}
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                      {img.brands?.name}
                    </span>
                    
                    {/* 시드 버튼 */}
                    {img.seed && (
                        <button 
                            onClick={() => handleCopySeed(img.seed)}
                            className="text-[10px] text-gray-500 hover:text-indigo-600 flex items-center gap-1 cursor-pointer border px-1.5 py-0.5 rounded bg-gray-50 hover:bg-white transition-colors"
                            title="시드 복사"
                        >
                            🌱 {img.seed}
                        </button>
                    )}
                </div>

                <p className="text-sm text-gray-800 line-clamp-3 leading-relaxed" title={img.prompt}>
                  {img.prompt}
                </p>
                
                <p className="text-xs text-gray-400 mt-3 border-t pt-2">
                  {new Date(img.created_at).toLocaleDateString()} {new Date(img.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}