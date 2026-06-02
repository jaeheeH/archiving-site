// app/(dashboard)/dashboard/brands/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

type TrainedModel = {
  status?: 'succeeded' | 'failed' | 'processing' | 'starting' | string;
};

type Brand = {
  id: string;
  name: string;
  trigger_word: string;
  created_at: string;
  thumbnail_url?: string | null;
  trained_models?: TrainedModel[];
};

type GeneratedBrandImage = {
  id: string;
  image_url: string;
  prompt: string | null;
  created_at: string | null;
};

export default function MyBrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [thumbnailModalBrand, setThumbnailModalBrand] = useState<Brand | null>(null);
  const [thumbnailImages, setThumbnailImages] = useState<GeneratedBrandImage[]>([]);
  const [thumbnailLoading, setThumbnailLoading] = useState(false);
  const [thumbnailError, setThumbnailError] = useState('');
  const [selectingThumbnailId, setSelectingThumbnailId] = useState<string | null>(null);
  
  // 수정 모드 상태
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '' }); // 이름만 수정 가능

  // 목록 불러오기
  const fetchBrands = async () => {
    try {
      const res = await fetch('/api/brands');
      const data = await res.json();
      if (Array.isArray(data)) {
        setBrands(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBrands();
  }, []);

  // 수정 시작
  const startEdit = (brand: Brand) => {
    setEditingId(brand.id);
    setEditForm({ name: brand.name });
  };

  // 수정 취소
  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: '' });
  };

  // 수정 저장 (이름만 변경)
  const handleUpdate = async () => {
    if (!editForm.name) return alert('이름을 입력해주세요.');

    try {
      const res = await fetch('/api/brands', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, name: editForm.name }), // 이름만 전송
      });

      if (!res.ok) throw new Error('수정 실패');
      
      alert('수정되었습니다.');
      setEditingId(null);
      fetchBrands();
    } catch (e) {
      alert('오류가 발생했습니다.');
    }
  };

  // 삭제 요청
  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까? \n연관된 모델과 이미지가 모두 삭제됩니다.')) return;

    try {
      const res = await fetch('/api/brands', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) throw new Error('삭제 실패');

      alert('삭제되었습니다.');
      setBrands(prev => prev.filter(b => b.id !== id));
    } catch (e) {
      alert('오류가 발생했습니다.');
    }
  };

  const openThumbnailPicker = async (brand: Brand) => {
    setThumbnailModalBrand(brand);
    setThumbnailImages([]);
    setThumbnailError('');
    setThumbnailLoading(true);

    try {
      const res = await fetch(`/api/brands/${brand.id}/thumbnail`, { cache: 'no-store' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '이미지 목록을 불러오지 못했습니다.');
      }

      setThumbnailImages(Array.isArray(data.images) ? data.images : []);
    } catch (error) {
      setThumbnailError(error instanceof Error ? error.message : '이미지 목록을 불러오지 못했습니다.');
    } finally {
      setThumbnailLoading(false);
    }
  };

  const closeThumbnailPicker = () => {
    setThumbnailModalBrand(null);
    setThumbnailImages([]);
    setThumbnailError('');
    setSelectingThumbnailId(null);
  };

  const selectThumbnail = async (image: GeneratedBrandImage) => {
    if (!thumbnailModalBrand) return;

    setSelectingThumbnailId(image.id);

    try {
      const res = await fetch(`/api/brands/${thumbnailModalBrand.id}/thumbnail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: image.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '대표 이미지를 저장하지 못했습니다.');
      }

      setBrands((prev) =>
        prev.map((brand) =>
          brand.id === thumbnailModalBrand.id
            ? { ...brand, thumbnail_url: data.thumbnail_url || image.image_url }
            : brand
        )
      );
      closeThumbnailPicker();
    } catch (error) {
      alert(error instanceof Error ? error.message : '대표 이미지를 저장하지 못했습니다.');
    } finally {
      setSelectingThumbnailId(null);
    }
  };

  // 상태 뱃지 컴포넌트
  const StatusBadge = ({ models }: { models?: TrainedModel[] }) => {
    const latestModel = models && models.length > 0 ? models[0] : null;
    const status = latestModel ? latestModel.status : 'pending';

    if (status === 'succeeded') {
      return <span className="px-2 py-1 text-[10px] font-bold text-green-700 bg-green-100 rounded-full border border-green-200">✅ 학습 완료</span>;
    } else if (status === 'failed') {
      return <span className="px-2 py-1 text-[10px] font-bold text-red-700 bg-red-100 rounded-full border border-red-200">❌ 학습 실패</span>;
    } else if (status === 'processing' || status === 'starting') {
      return <span className="px-2 py-1 text-[10px] font-bold text-blue-700 bg-blue-100 rounded-full animate-pulse border border-blue-200">🔄 학습 중...</span>;
    } else {
      return <span className="px-2 py-1 text-[10px] font-bold text-gray-700 bg-gray-100 rounded-full border border-gray-200">⏳ 대기 중</span>;
    }
  };

  if (loading) return <div className="p-4 sm:p-6 lg:p-8">로딩 중...</div>;

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
           <h1 className="text-2xl font-bold">내 브랜드 관리</h1>
           <p className="text-sm text-gray-500 mt-1">등록된 브랜드와 학습 상태를 확인하세요.</p>
        </div>
        <Link href="/dashboard/brand-kit">
          <Button className="w-full bg-black text-white hover:bg-gray-800 sm:w-auto">
            + 새 브랜드 만들기
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {brands.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 border-2 border-dashed rounded-lg">
            <p className="text-gray-500 mb-4">아직 등록된 브랜드가 없습니다.</p>
            <Link href="/dashboard/brand-kit" className="text-blue-600 hover:underline">
              첫 브랜드 만들러 가기 &rarr;
            </Link>
          </div>
        ) : (
          brands.map((brand) => (
            <div key={brand.id} className="flex flex-col items-start justify-between gap-4 rounded-lg border bg-white p-4 shadow-sm transition-colors hover:border-gray-300 sm:p-6 md:flex-row md:items-center">
              
              {editingId === brand.id ? (
                // [수정 모드 UI]
                <div className="flex-1 w-full space-y-4 bg-gray-50 p-4 rounded-md border border-indigo-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 font-bold mb-1 block">브랜드 이름 (수정 가능)</label>
                      <input 
                        type="text" 
                        className="w-full p-2 border rounded bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={editForm.name}
                        onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                      />
                    </div>
                    
                    {/* 트리거 단어 (읽기 전용) */}
                    <div>
                      <label className="text-xs text-gray-400 font-bold mb-1 block">트리거 단어 (수정 불가)</label>
                      <div className="w-full p-2 border rounded bg-gray-200 text-gray-500 font-mono select-none cursor-not-allowed">
                        {brand.trigger_word}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">
                        * 학습된 모델 연결 보호를 위해 수정할 수 없습니다.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button onClick={cancelEdit} variant="outline" className="h-8 text-xs bg-white">
                      취소
                    </Button>
                    <Button onClick={handleUpdate} className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs">
                      저장하기
                    </Button>
                  </div>
                </div>
              ) : (
                // [일반 보기 UI]
                <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-center">
                  <BrandThumbnail brand={brand} />
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-3">
                      <h3 className="truncate text-xl font-bold text-gray-900">{brand.name}</h3>
                      <StatusBadge models={brand.trained_models} />
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                      <div className="flex min-w-0 items-center gap-2 rounded-md border bg-gray-50 px-3 py-1.5">
                          <span className="shrink-0 text-xs font-bold text-gray-400">TRIGGER ID</span>
                          <span className="truncate font-mono font-bold tracking-wide text-indigo-600">
                          {brand.trigger_word}
                          </span>
                      </div>
                      <span className="text-xs text-gray-400">
                        생성일: {new Date(brand.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 버튼 그룹 (수정 모드가 아닐 때만 보임) */}
              {editingId !== brand.id && (
                <div className="flex w-full flex-wrap items-center justify-end gap-2 md:w-auto md:self-center">
                   {/* 바로 Studio로 이동하는 버튼 */}
                   <Link href={`/dashboard/studio?brand=${brand.id}`} className="w-full sm:w-auto">
                    <Button variant="outline" className="h-10 w-full border-indigo-200 px-4 font-medium text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 sm:w-auto">
                      🎨 이미지 생성하기
                    </Button>
                  </Link>
                  <Button
                    onClick={() => openThumbnailPicker(brand)}
                    variant="outline"
                    className="h-10 border-gray-200 px-4 text-gray-700 hover:bg-gray-50 hover:text-gray-950"
                  >
                    썸네일 선택
                  </Button>
                  
                  <div className="h-6 w-px bg-gray-200 mx-1"></div>

                  <Button onClick={() => startEdit(brand)} variant="ghost" size="sm" className="text-gray-500 hover:text-gray-900">
                    수정
                  </Button>
                  
                  <Button onClick={() => handleDelete(brand.id)} variant="ghost" size="sm" className="text-red-400 hover:text-red-600 hover:bg-red-50">
                    삭제
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {thumbnailModalBrand && (
        <ThumbnailPickerModal
          brand={thumbnailModalBrand}
          images={thumbnailImages}
          loading={thumbnailLoading}
          error={thumbnailError}
          selectingId={selectingThumbnailId}
          onClose={closeThumbnailPicker}
          onSelect={selectThumbnail}
        />
      )}
    </div>
  );
}

function BrandThumbnail({ brand }: { brand: Brand }) {
  const fallback = brand.name.trim().charAt(0).toUpperCase() || 'B';

  return (
    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-gray-100">
      {brand.thumbnail_url ? (
        <img
          src={brand.thumbnail_url}
          alt={`${brand.name} 썸네일`}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gray-950 text-lg font-bold text-white">
          {fallback}
        </div>
      )}
    </div>
  );
}

function ThumbnailPickerModal({
  brand,
  images,
  loading,
  error,
  selectingId,
  onClose,
  onSelect,
}: {
  brand: Brand;
  images: GeneratedBrandImage[];
  loading: boolean;
  error: string;
  selectingId: string | null;
  onClose: () => void;
  onSelect: (image: GeneratedBrandImage) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-lg border bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b px-4 py-5 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400">Brand Thumbnail</p>
            <h2 className="mt-1 text-xl font-bold text-gray-950">{brand.name}</h2>
            <p className="mt-1 text-sm text-gray-500">
              이 브랜드로 생성한 이미지 중 대표 썸네일을 선택하세요.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-500 hover:text-gray-950">
            닫기
          </Button>
        </div>

        <div className="max-h-[68vh] overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex min-h-48 items-center justify-center rounded-md border border-dashed text-sm text-gray-500">
              이미지 목록을 불러오는 중입니다.
            </div>
          ) : error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : images.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-md border border-dashed text-center">
              <p className="text-sm font-semibold text-gray-900">아직 생성한 이미지가 없습니다.</p>
              <p className="mt-1 text-sm text-gray-500">Studio에서 이 브랜드로 이미지를 만든 뒤 선택할 수 있어요.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {images.map((image) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => onSelect(image)}
                  disabled={selectingId !== null}
                  className="group overflow-hidden rounded-lg border bg-white text-left transition hover:border-gray-950 disabled:cursor-wait disabled:opacity-70"
                >
                  <div className="aspect-square overflow-hidden bg-gray-100">
                    <img
                      src={image.image_url}
                      alt={image.prompt || `${brand.name} 생성 이미지`}
                      className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-2 min-h-10 text-sm font-medium text-gray-900">
                      {image.prompt || '프롬프트 없음'}
                    </p>
                    <p className="mt-2 text-xs text-gray-400">
                      {selectingId === image.id ? '저장 중...' : '대표 이미지로 선택'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
