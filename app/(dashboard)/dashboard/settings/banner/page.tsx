// app/(dashboard)/dashboard/setting/banners/page.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ToastProvider';
import { useImageUpload } from '@/hooks/useImageUpload';

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
  is_active: boolean;
}

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [formData, setFormData] = useState<Partial<Banner>>({});
  const { addToast } = useToast();
  const supabase = createClient();
  const { uploadImage, uploading: isUploading } = useImageUpload();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // 배너 목록 로드
  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .order('order_index', { ascending: true });

      if (error) throw error;
      setBanners(data || []);
    } catch (error) {
      console.error('Failed to fetch banners:', error);
      addToast('배너 목록을 불러올 수 없습니다', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 미리보기 표시
    const reader = new FileReader();
    reader.onload = (event) => {
      setPreviewUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    // 이미지 업로드
    try {
      const url = await uploadImage(file, 'banners', false);
      if (url) {
        setFormData({ ...formData, image_url: url });
        addToast('이미지가 업로드되었습니다', 'success');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      addToast('이미지 업로드에 실패했습니다', 'error');
    }
  };

  const handleEdit = (banner: Banner) => {
    setEditing(banner);
    setFormData(banner);
    setPreviewUrl(banner.image_url);
  };

  const handleSave = async () => {
    if (!formData.title || !formData.image_url) {
      addToast('제목과 이미지는 필수입니다', 'error');
      return;
    }

    try {
      if (editing) {
        // 수정
        const { error } = await supabase
          .from('banners')
          .update(formData)
          .eq('id', editing.id);

        if (error) throw error;
        addToast('배너가 수정되었습니다', 'success');
      } else {
        // 생성
        const { error } = await supabase
          .from('banners')
          .insert([formData]);

        if (error) throw error;
        addToast('배너가 추가되었습니다', 'success');
      }

      setEditing(null);
      setFormData({});
      setPreviewUrl(null);
      fetchBanners();
    } catch (error) {
      console.error('Failed to save banner:', error);
      addToast('저장에 실패했습니다', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 배너를 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('banners')
        .delete()
        .eq('id', id);

      if (error) throw error;
      addToast('배너가 삭제되었습니다', 'success');
      fetchBanners();
    } catch (error) {
      console.error('Failed to delete banner:', error);
      addToast('삭제에 실패했습니다', 'error');
    }
  };

  if (loading) {
    return <div className="p-8">로딩 중...</div>;
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">배너 관리</h1>
        <button
          onClick={() => {
            setEditing(null);
            setFormData({ is_continuous: true, is_active: true, order_index: banners.length + 1 });
            setPreviewUrl(null);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + 새 배너
        </button>
      </div>

      {/* 편집 폼 */}
      {(editing !== null || Object.keys(formData).length > 0) && (
        <div className="bg-gray-50 p-6 rounded-lg mb-8 border border-gray-200">
          <h2 className="text-lg font-bold mb-4">
            {editing ? '배너 수정' : '새 배너 추가'}
          </h2>

          <div className="space-y-4">
            {/* 제목 */}
            <div>
              <label className="block text-sm font-medium mb-1">제목 *</label>
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="배너 제목"
                className="w-full border p-2 rounded"
              />
            </div>

            {/* 부제목 */}
            <div>
              <label className="block text-sm font-medium mb-1">부제목</label>
              <input
                type="text"
                value={formData.subtitle || ''}
                onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                placeholder="부제목"
                className="w-full border p-2 rounded"
              />
            </div>

            {/* 라벨 */}
            <div>
              <label className="block text-sm font-medium mb-1">라벨</label>
              <input
                type="text"
                value={formData.label || ''}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="FEATURED WORK"
                className="w-full border p-2 rounded"
              />
            </div>

            {/* 이미지 업로드 */}
            <div>
              <label className="block text-sm font-medium mb-2">이미지 *</label>
              
              {/* 이미지 미리보기 */}
              {previewUrl && (
                <div className="mb-4 relative w-full h-40 bg-gray-100 rounded border">
                  <Image
                    src={previewUrl}
                    alt="Preview"
                    fill
                    className="object-contain"
                  />
                </div>
              )}

              {/* 업로드 버튼 */}
              <div className="flex gap-2">
                <button
                  onClick={() => imageInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                >
                  {isUploading ? '업로드 중...' : '이미지 선택'}
                </button>
                {previewUrl && (
                  <button
                    onClick={() => {
                      setPreviewUrl(null);
                      setFormData({ ...formData, image_url: '' });
                    }}
                    className="px-4 py-2 bg-red-200 text-red-700 rounded hover:bg-red-300"
                  >
                    제거
                  </button>
                )}
              </div>

              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />

              {/* URL 직접 입력 (옵션) */}
              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-1">또는 직접 URL 입력:</p>
                <input
                  type="text"
                  value={formData.image_url || ''}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full border p-2 rounded text-sm"
                />
              </div>
            </div>

            {/* 링크 */}
            <div>
              <label className="block text-sm font-medium mb-1">클릭 링크</label>
              <input
                type="text"
                value={formData.link || ''}
                onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                placeholder="/gallery"
                className="w-full border p-2 rounded"
              />
            </div>

            {/* 계속 운영 여부 */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isContinuous"
                checked={formData.is_continuous || false}
                onChange={(e) => {
                  setFormData({ ...formData, is_continuous: e.target.checked });
                }}
              />
              <label htmlFor="isContinuous" className="text-sm">
                계속 운영 (날짜 무시)
              </label>
            </div>

            {/* 시작 날짜 - 계속 운영이 아닐 때만 */}
            {!formData.is_continuous && (
              <div>
                <label className="block text-sm font-medium mb-1">시작 날짜</label>
                <input
                  type="date"
                  value={formData.start_date?.split('T')[0] || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      start_date: new Date(e.target.value).toISOString(),
                    })
                  }
                  className="w-full border p-2 rounded"
                />
              </div>
            )}

            {/* 종료 날짜 - 계속 운영이 아닐 때만 */}
            {!formData.is_continuous && (
              <div>
                <label className="block text-sm font-medium mb-1">종료 날짜</label>
                <input
                  type="date"
                  value={formData.end_date?.split('T')[0] || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      end_date: new Date(e.target.value).toISOString(),
                    })
                  }
                  className="w-full border p-2 rounded"
                />
              </div>
            )}

            {/* 순서 */}
            <div>
              <label className="block text-sm font-medium mb-1">순서</label>
              <input
                type="number"
                value={formData.order_index || 0}
                onChange={(e) => setFormData({ ...formData, order_index: parseInt(e.target.value) })}
                className="w-full border p-2 rounded"
              />
            </div>

            {/* 활성화 */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.is_active !== false}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              />
              <label htmlFor="isActive" className="text-sm">
                활성화
              </label>
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex gap-2 mt-6">
            <button
              onClick={handleSave}
              disabled={isUploading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              저장
            </button>
            <button
              onClick={() => {
                setEditing(null);
                setFormData({});
                setPreviewUrl(null);
              }}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 배너 목록 */}
      <div className="space-y-4">
        {banners.map((banner) => (
          <div key={banner.id} className="border p-4 rounded-lg bg-white">
            <div className="flex items-start justify-between gap-4">
              {/* 배너 미리보기 */}
              <div className="w-32 h-24 relative flex-shrink-0 bg-gray-100 rounded overflow-hidden">
                <Image
                  src={banner.image_url}
                  alt={banner.title}
                  fill
                  className="object-cover"
                />
              </div>

              {/* 배너 정보 */}
              <div className="flex-1">
                <h3 className="font-bold text-lg">{banner.title}</h3>
                {banner.subtitle && <p className="text-sm text-gray-600">{banner.subtitle}</p>}
                <p className="text-xs text-gray-500 mt-2">
                  {banner.is_continuous
                    ? '계속 운영'
                    : `${banner.start_date?.split('T')[0]} ~ ${banner.end_date?.split('T')[0]}`}
                </p>
                <p className="text-xs text-gray-500">
                  상태: {banner.is_active ? '활성' : '비활성'} | 순서: {banner.order_index}
                </p>
              </div>

              {/* 액션 버튼 */}
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => handleEdit(banner)}
                  className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                >
                  수정
                </button>
                <button
                  onClick={() => handleDelete(banner.id)}
                  className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}