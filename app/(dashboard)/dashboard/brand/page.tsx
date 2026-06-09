// app/(dashboard)/dashboard/brands/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  ImageIcon,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';

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

type BrandStatus = 'ready' | 'failed' | 'training' | 'pending';

function getBrandStatus(models?: TrainedModel[]): BrandStatus {
  const latestStatus = models?.[0]?.status || 'pending';

  if (latestStatus === 'succeeded') return 'ready';
  if (latestStatus === 'failed') return 'failed';
  if (latestStatus === 'processing' || latestStatus === 'starting') return 'training';
  return 'pending';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

function StatusBadge({ models }: { models?: TrainedModel[] }) {
  const status = getBrandStatus(models);
  const style = {
    ready: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    failed: 'border-red-200 bg-red-50 text-red-700',
    training: 'border-blue-200 bg-blue-50 text-blue-700',
    pending: 'border-gray-200 bg-gray-50 text-gray-600',
  }[status];
  const label = {
    ready: '학습 완료',
    failed: '학습 실패',
    training: '학습 중',
    pending: '대기 중',
  }[status];

  return (
    <span className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold ${style}`}>
      {status === 'ready' && <CheckCircle2 className="h-3.5 w-3.5" />}
      {status === 'failed' && <XCircle className="h-3.5 w-3.5" />}
      {status === 'training' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {status === 'pending' && <Clock3 className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'dark' | 'green' | 'blue' | 'gray';
}) {
  const toneClass = {
    dark: 'text-gray-950',
    green: 'text-emerald-700',
    blue: 'text-blue-700',
    gray: 'text-gray-600',
  }[tone];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-3 text-3xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

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

  const summary = brands.reduce(
    (acc, brand) => {
      const status = getBrandStatus(brand.trained_models);
      acc.total += 1;
      if (status === 'ready') acc.ready += 1;
      if (status === 'training') acc.training += 1;
      if (status === 'pending') acc.pending += 1;
      if (status === 'failed') acc.failed += 1;
      return acc;
    },
    { total: 0, ready: 0, training: 0, pending: 0, failed: 0 }
  );

  if (loading) {
    return (
      <div>
        <header className="dashboard-Header">
          <div>
            <h1>Brand</h1>
            <p className="mt-1 text-xs text-gray-500">브랜드 목록을 불러오고 있습니다.</p>
          </div>
        </header>
        <main className="dashboard-container">
          <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white">
            <span className="inline-flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              로딩 중
            </span>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div>
      <header className="dashboard-Header">
        <div>
          <h1>Brand</h1>
          <p className="mt-1 text-xs text-gray-500">브랜드 상태와 대표 이미지를 관리합니다.</p>
        </div>
        <Button asChild className="bg-gray-900 text-white hover:bg-gray-800">
          <Link href="/dashboard/brand-kit">
            <Plus className="h-4 w-4" />
            새 브랜드
          </Link>
        </Button>
      </header>

      <main className="dashboard-container space-y-6">
        <section className="grid gap-4 md:grid-cols-4">
          <SummaryCard label="전체 브랜드" value={summary.total} tone="dark" />
          <SummaryCard label="학습 완료" value={summary.ready} tone="green" />
          <SummaryCard label="학습 중" value={summary.training} tone="blue" />
          <SummaryCard label="대기/실패" value={summary.pending + summary.failed} tone="gray" />
        </section>

        {brands.length === 0 ? (
          <section className="flex min-h-[420px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-gray-100 text-gray-700">
                <ImageIcon className="h-6 w-6" />
              </div>
              <h2 className="mt-5 text-lg font-semibold text-gray-950">등록된 브랜드가 없습니다.</h2>
              <p className="mt-2 text-sm text-gray-500">첫 브랜드를 만들면 Studio에서 바로 이미지를 생성할 수 있습니다.</p>
              <Button asChild className="mt-5 bg-gray-900 text-white hover:bg-gray-800">
                <Link href="/dashboard/brand-kit">
                  <Plus className="h-4 w-4" />
                  브랜드 만들기
                </Link>
              </Button>
            </div>
          </section>
        ) : (
          <section className="grid gap-4 lg:grid-cols-3 xl:grid-cols-5">
            {brands.map((brand) => (
              <article
                key={brand.id}
                className="overflow-hidden rounded-lg border border-gray-200 bg-white transition hover:border-gray-300 hover:shadow-sm"
              >
                {editingId === brand.id ? (
                  <div className="p-5">
                    <div className="mb-5 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Edit Brand</p>
                        <h2 className="mt-1 text-lg font-semibold text-gray-950">{brand.name}</h2>
                      </div>
                      <StatusBadge models={brand.trained_models} />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-gray-500">브랜드 이름</label>
                        <input
                          type="text"
                          className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-gray-400"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-gray-500">Trigger ID</label>
                        <div className="flex h-10 items-center rounded-md border border-gray-200 bg-gray-50 px-3 font-mono text-sm font-semibold text-gray-500">
                          {brand.trigger_word}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex justify-end gap-2">
                      <Button onClick={cancelEdit} variant="outline" size="sm">
                        취소
                      </Button>
                      <Button onClick={handleUpdate} size="sm" className="bg-gray-900 text-white hover:bg-gray-800">
                        저장
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <BrandThumbnail brand={brand} />
                    <div className="p-5">
                      <div className="mb-4 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h2 className="truncate text-xl font-semibold text-gray-950">{brand.name}</h2>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {formatDate(brand.created_at)}
                          </p>
                        </div>
                        <StatusBadge models={brand.trained_models} />
                      </div>

                      <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">Trigger ID</p>
                        <p className="mt-1 truncate font-mono text-sm font-semibold text-gray-800">{brand.trigger_word}</p>
                      </div>

                      <div className="mt-5 flex flex-wrap items-center gap-2">
                        <Button asChild className="bg-gray-900 text-white hover:bg-gray-800">
                          <Link href={`/dashboard/studio?brand=${brand.id}`}>
                            <Sparkles className="h-4 w-4" />
                            생성하기
                          </Link>
                        </Button>
                        <Button
                          onClick={() => openThumbnailPicker(brand)}
                          variant="outline"
                          className="border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-950"
                        >
                          <ImagePlus className="h-4 w-4" />
                          썸네일
                        </Button>
                        <div className="ml-auto flex items-center gap-1">
                          <Button
                            onClick={() => startEdit(brand)}
                            variant="ghost"
                            size="icon-sm"
                            className="text-gray-500 hover:text-gray-950"
                            title="수정"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            onClick={() => handleDelete(brand.id)}
                            variant="ghost"
                            size="icon-sm"
                            className="text-red-500 hover:bg-red-50 hover:text-red-600"
                            title="삭제"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </article>
            ))}
          </section>
        )}
      </main>

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
    <div className="relative aspect-square overflow-hidden bg-gray-100">
      {brand.thumbnail_url ? (
        <img
          src={brand.thumbnail_url}
          alt={`${brand.name} 썸네일`}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gray-950 text-5xl font-semibold text-white">
          <span>{fallback}</span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
      <div className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-5 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Brand Thumbnail</p>
            <h2 className="mt-1 text-xl font-semibold text-gray-950">{brand.name}</h2>
            <p className="mt-1 text-sm text-gray-500">대표 이미지로 사용할 생성 이미지를 선택합니다.</p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} className="text-gray-500 hover:text-gray-950" title="닫기">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="overflow-y-auto p-5 sm:p-6">
          {loading ? (
            <div className="flex min-h-64 items-center justify-center rounded-lg border border-dashed border-gray-300 text-sm text-gray-500">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                이미지 목록을 불러오는 중
              </span>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : images.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 text-center">
              <ImageIcon className="h-6 w-6 text-gray-400" />
              <p className="mt-3 text-sm font-semibold text-gray-900">생성한 이미지가 없습니다.</p>
              <p className="mt-1 text-sm text-gray-500">Studio에서 이 브랜드로 이미지를 만든 뒤 선택할 수 있습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {images.map((image) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => onSelect(image)}
                  disabled={selectingId !== null}
                  className="group overflow-hidden rounded-lg border border-gray-200 bg-white text-left transition hover:border-gray-950 disabled:cursor-wait disabled:opacity-70"
                >
                  <div className="relative aspect-square overflow-hidden bg-gray-100">
                    <img
                      src={image.image_url}
                      alt={image.prompt || `${brand.name} 생성 이미지`}
                      className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                    />
                    {selectingId === image.id && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-white">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-2 min-h-10 text-sm font-medium text-gray-900">
                      {image.prompt || '프롬프트 없음'}
                    </p>
                    <p className="mt-2 text-xs font-medium text-gray-500">
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
