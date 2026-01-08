'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SimilarGalleryModal from '@/components/gallery/SimilarGalleryModal';

type GalleryDetail = {
  id: number;
  title: string;
  description?: string;
  image_url: string;
  image_width: number;
  image_height: number;
  tags: string[];
  gemini_tags: string[];
  gemini_description?: string;
  category?: string;
  created_at: string;
  author?: string;
};

interface GalleryDetailClientProps {
  gallery: GalleryDetail;
  canEdit: boolean;
  nextId: number | null;
  prevId: number | null;
}

export default function GalleryDetailClient({ 
  gallery, 
  canEdit,
  nextId,
  prevId 
}: GalleryDetailClientProps) {
  const router = useRouter();
  const [showSimilarModal, setShowSimilarModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // ✅ 복사 상태 관리
  const [isCopied, setIsCopied] = useState(false);

  // ✅ 프롬프트(설명) 복사 핸들러
  const handleCopyPrompt = async () => {
    if (!gallery.description) return;

    try {
      await navigator.clipboard.writeText(gallery.description);
      setIsCopied(true);
      
      // 2초 후 상태 초기화
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      alert('복사에 실패했습니다.');
    }
  };

  const handleDelete = async () => {
    if (!confirm('정말 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.')) return;

    try {
      setIsDeleting(true);
      const res = await fetch(`/api/gallery/${gallery.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('삭제 실패');

      alert('삭제되었습니다.');
      router.replace('/gallery'); 
      router.refresh(); 
    } catch (error) {
      console.error(error);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen max-w-7xl mx-auto py-12 px-4 md:px-6">
      {/* 상단 네비게이션 */}
      <div className="flex items-center justify-between mb-8">
        <button 
          onClick={() => router.back()} 
          className="inline-flex items-center text-gray-500 hover:text-black transition-colors"
        >
          <i className="ri-arrow-left-line mr-2"></i>
          Back
        </button>

        <div className="flex items-center gap-2">
          {nextId && (
            <Link 
              href={`/gallery/${nextId}`}
              className="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-full transition-all"
              title="Newer Post"
            >
              <i className="ri-arrow-left-s-line text-2xl"></i>
            </Link>
          )}
          {prevId && (
            <Link 
              href={`/gallery/${prevId}`}
              className="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-full transition-all"
              title="Older Post"
            >
              <i className="ri-arrow-right-s-line text-2xl"></i>
            </Link>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        {/* 이미지 섹션 */}
        <div className="relative group h-fit">
          <div className="relative w-full bg-gray-50 rounded-xl overflow-hidden border border-gray-100 shadow-sm" 
                style={{ aspectRatio: `${gallery.image_width} / ${gallery.image_height}` }}>
            <Image
              src={gallery.image_url}
              alt={gallery.title}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-contain"
              placeholder="blur"
              blurDataURL="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3Crect fill='%23f3f4f6' width='16' height='9'/%3E%3C/svg%3E"
              priority
            />
          </div>
        </div>

        {/* 정보 섹션 */}
        <div className="flex flex-col h-full">
          <div className="flex-1 space-y-8">
            {/* 타이틀 및 메타 정보 */}
            <div>
              <div className="flex items-start justify-between gap-4">
                <h1 className="text-3xl font-bold text-gray-900 mb-2 leading-tight">
                  {gallery.title}
                </h1>
                
                {canEdit && (
                  <div className="flex shrink-0 gap-2">
                    <Link
                      href={`/dashboard/contents/gallery/${gallery.id}/edit`}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <i className="ri-edit-line text-xl"></i>
                    </Link>
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <i className="ri-delete-bin-line text-xl"></i>
                    </button>
                  </div>
                )}
              </div>


              <div className="flex items-center gap-3 text-sm text-gray-500 mt-2">
                <span className="font-mono">
                  {new Date(gallery.created_at).toLocaleDateString("ko-KR", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  })}
                </span>
                {gallery.category && (
                  <>
                    <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                    <span className="px-2.5 py-0.5 bg-gray-100 rounded-md text-xs font-medium text-gray-600">
                      {gallery.category}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* AI 분석 내용 */}
            {gallery.gemini_description && (
              <div>
                <div className="flex items-center gap-2 mb-3 ">
                  <i className="ri-sparkling-fill"></i>
                  <h3 className="text-xs font-bold uppercase tracking-widest">AI Analysis</h3>
                </div>
                <p className="text-gray-600 leading-relaxed ">
                  {gallery.gemini_description}
                </p>
              </div>
            )}

            {/* ✅ 설명 (Prompt) 섹션 - 복사 기능 추가 */}
            {gallery.description && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                    Prompt
                  </h3>
                  <button
                    onClick={handleCopyPrompt}
                    className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md transition-all ${
                      isCopied 
                        ? 'bg-green-50 text-green-600' 
                        : 'text-gray-500 hover:text-black hover:bg-gray-100'
                    }`}
                    title="Copy prompt to clipboard"
                  >
                    {isCopied ? (
                      <>
                        <i className="ri-check-line text-sm"></i>
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <i className="ri-file-copy-line text-sm"></i>
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 font-mono text-sm text-gray-800 leading-relaxed whitespace-pre-wrap selection:bg-black selection:text-white">
                  {gallery.description}
                </div>
              </div>
            )}


            {/* 태그 */}
            {(gallery.tags?.length > 0 || gallery.gemini_tags?.length > 0) && (
              <div className="pt-2">
                <div className="flex flex-wrap gap-2">
                  {[...(gallery.tags || []), ...(gallery.gemini_tags || [])].map((tag, idx) => (
                    <Link
                      key={`${tag}-${idx}`}
                      href={`/gallery?tags=${tag}`}
                      className="px-3 py-1.5 bg-white border border-gray-300 text-gray-500 rounded-sm text-xs font-medium hover:border-black hover:text-black transition-all"
                    >
                      #{tag}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {/* 하단 액션 버튼 */}
            <div className="pt-8 mt-8 border-t border-gray-100">
              <button
                onClick={() => setShowSimilarModal(true)}
                className="w-full bg-black text-white rounded-xl py-4 font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-gray-200"
              >
                <i className="ri-image-line"></i>
                <span>View Similar Styles</span>
              </button>
            </div>
          </div>


        </div>
      </div>

      {/* 유사 이미지 모달 */}
      {showSimilarModal && (
        <SimilarGalleryModal
          galleryId={gallery.id}
          title={gallery.title}
          onClose={() => setShowSimilarModal(false)}
          onSelectImage={(newId) => {
            setShowSimilarModal(false);
            router.push(`/gallery/${newId}`);
          }}
        />
      )}
    </div>
  );
}