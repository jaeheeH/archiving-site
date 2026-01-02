// app/(dashboard)/components/Editor/BrunchWriteEditor.tsx (수정본)

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { JSONContent } from '@tiptap/react';
import BrunchTipTapEditor from './BrunchTipTapEditor';
import { generateSlug } from '@/lib/slugify';
import { useToast } from '@/components/ToastProvider';
import MetaData from '@/components/Editor/MetaData';
import { useImageUpload } from '@/hooks/useImageUpload';

interface WriteEditorProps {
  type?: 'blog' | 'magazine' | 'news';
  postId?: string;
}

export default function BrunchWriteEditor({ type = 'blog', postId }: WriteEditorProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const { uploadImage, uploading: isUploading } = useImageUpload();

  const titleImageInputRef = useRef<HTMLInputElement>(null);

  // 상태 관리
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [summary, setSummary] = useState('');
  const [titleImageUrl, setTitleImageUrl] = useState('');
  const [content, setContent] = useState<JSONContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [slug, setSlug] = useState(''); // 🆕 slug 상태 추가

  // 🆕 이전 slug 기록 (수정 시 변경 감지용)
  const [previousSlug, setPreviousSlug] = useState('');

  // AI 태그 생성 로딩 상태
  const [generatingTags, setGeneratingTags] = useState(false);

  // 포스트 데이터 로드
  useEffect(() => {
    if (!postId) return;

    const loadPost = async () => {
      try {
        const res = await fetch(`/api/posts/${postId}`);
        if (!res.ok) throw new Error('Failed to fetch post');

        const { data } = await res.json();
        setTitle(data.title);
        setSubtitle(data.subtitle || '');
        setSummary(data.summary || '');
        setTitleImageUrl(data.title_image_url || '');
        setContent(data.content);
        setCategoryId(data.category_id || '');
        setTags(data.tags || []);
        setSlug(data.slug); // 🆕 기존 slug 로드
        setPreviousSlug(data.slug); // 🆕 이전 slug 저장
      } catch (error) {
        console.error('포스트 로드 실패:', error);
        addToast('포스트를 불러올 수 없습니다.', 'error');
      }
    };
    loadPost();
  }, [postId, addToast]);

  // 🆕 제목 변경 시 slug 자동 생성
  useEffect(() => {
    if (!title.trim()) {
      setSlug('');
      return;
    }

    // 새 slug 생성 (타임스탬프 제외, 생성 시에만 타임스탬프 추가)
    const newSlug = generateSlug(title, false);
    setSlug(newSlug);
  }, [title]);

  // 제목 이미지 업로드 핸들러
  const handleTitleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = await uploadImage(file, 'posts/titles');
    if (url) {
      setTitleImageUrl(url);
      addToast('제목 배경이 설정되었습니다.', 'success');
    }
  };

  // AI 태그 생성
  const handleGenerateTags = async () => {
    if (!title && (!content || !content.content)) {
      addToast('제목이나 본문을 먼저 작성해주세요.', 'error');
      return;
    }

    setGeneratingTags(true);
    try {
      const response = await fetch('/api/posts/generate-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          subtitle,
          content,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || '태그 생성 실패';
        if (errorMsg.includes('404') || errorMsg.includes('not found')) {
          throw new Error('AI 모델을 찾을 수 없습니다. (서버 설정을 확인해주세요)');
        }
        throw new Error(errorMsg);
      }

      if (data.tags && data.tags.length > 0) {
        const newTags = Array.from(new Set([...tags, ...data.tags]));
        setTags(newTags);
        addToast(`✨ AI가 ${data.tags.length}개의 태그를 추천했습니다!`, 'success');
      } else {
        addToast('추천할 만한 태그를 찾지 못했습니다.', 'info');
      }

    } catch (error: any) {
      console.error('Tag Generation Error:', error);
      addToast(error.message || 'AI 태그 생성 중 오류가 발생했습니다.', 'error');
    } finally {
      setGeneratingTags(false);
    }
  };

  // 저장/발행 핸들러
  const handleSave = async (isPublish: boolean = false) => {
    if (loading || isUploading || generatingTags) return;

    if (!title.trim()) {
      addToast('제목을 입력해주세요.', 'error');
      return;
    }
    if (!content) {
      addToast('본문을 작성해주세요.', 'error');
      return;
    }
    if (!slug) {
      addToast('slug를 생성해주세요. (제목이 올바른지 확인하세요)', 'error');
      return;
    }

    setLoading(true);

    try {
      // 요약이 없으면 AI 자동 생성 시도
      let finalSummary = summary;
      if (!finalSummary && (title || content)) {
        try {
          const summaryResponse = await fetch('/api/posts/generate-summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, subtitle, content }),
          });

          if (summaryResponse.ok) {
            const summaryData = await summaryResponse.json();
            if (summaryData.summary) {
              finalSummary = summaryData.summary;
              setSummary(finalSummary);
              console.log('Summary generated:', finalSummary);
            }
          }
        } catch (error) {
          console.error('요약 생성 실패 (저장은 계속 진행):', error);
        }
      }

      // 요청 데이터 구성
      const requestData = {
        type,
        title,
        subtitle: subtitle || null,
        summary: finalSummary || null,
        slug, // 🆕 자동 생성된 slug 사용
        content,
        title_style: titleImageUrl ? 'image' : 'text',
        title_image_url: titleImageUrl || null,
        category_id: categoryId || null,
        tags: tags,
        is_published: isPublish,
        published_at: isPublish ? new Date().toISOString() : null,
      };

      const method = postId ? 'PUT' : 'POST';
      const url = postId ? `/api/posts/${postId}` : '/api/posts';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();

      if (response.ok) {
        // 🆕 slug 변경 감지 메시지
        if (postId && result.slugChanged) {
          addToast(
            `slug가 변경되었습니다: ${previousSlug} → ${slug}`,
            'info'
          );
          setPreviousSlug(slug);
        }

        addToast(
          isPublish ? '발행되었습니다!' : '저장되었습니다.',
          'success'
        );
        router.push('/dashboard/contents/blog');
      } else {
        if (response.status === 401) {
          addToast('로그인이 만료되었습니다.', 'error');
          router.push('/login');
        } else {
          throw new Error(result.error || '저장 실패');
        }
      }
    } catch (error: any) {
      addToast(`오류 발생: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pb-32">
      <header className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-b border-gray-100 z-50 transition-all">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 text-gray-400 hover:text-gray-900 transition-colors rounded-full hover:bg-gray-100"
          >
            <i className="ri-arrow-left-line text-xl"></i>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSave(false)}
              disabled={loading || isUploading}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-900 transition disabled:opacity-50"
            >
              저장
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={loading || isUploading}
              className="px-4 py-1.5 text-sm bg-[#00c4c4] text-white rounded-full hover:bg-[#00b3b3] transition shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <i className="ri-loader-4-line animate-spin"></i> : null}
              <span>발행</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 pt-24">
        
        {/* 제목 이미지 영역 */}
        <div className="group relative mb-10 transition-all">
          {titleImageUrl ? (
            <div className="relative rounded-xl overflow-hidden shadow-sm aspect-[21/9]">
              <img src={titleImageUrl} alt="Cover" className="w-full h-full object-cover" />
              <button 
                onClick={() => setTitleImageUrl('')}
                className="absolute top-3 right-3 p-2 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm hover:bg-black/70"
              >
                <i className="ri-close-line"></i>
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => titleImageInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-2 text-gray-400 hover:text-gray-600 transition-colors py-2"
              >
                <i className="ri-image-add-line text-xl"></i>
                <span className="text-sm">커버 이미지 추가</span>
              </button>
            </>
          )}
          <input 
            ref={titleImageInputRef}
            type="file" 
            accept="image/*" 
            onChange={handleTitleImageUpload} 
            className="hidden" 
          />
        </div>

        {/* 제목 & 부제목 */}
        <div className="space-y-4 mb-12">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력하세요"
            className="w-full text-4xl font-bold placeholder-gray-200 outline-none bg-transparent"
            autoFocus
          />
          <input
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="소제목을 입력하세요 (선택)"
            className="w-full text-xl text-gray-500 font-light placeholder-gray-200 outline-none bg-transparent"
          />
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="요약글 (저장 시 AI가 자동 생성합니다)"
            rows={3}
            className="w-full text-base text-gray-600 placeholder-gray-300 outline-none bg-transparent border-t border-gray-100 pt-4 resize-none"
          />

          {/* 🆕 slug 표시 영역 */}
          <div className="pt-4 border-t border-gray-100">
            <label className="text-xs text-gray-500 font-medium">URL Slug</label>
            <div className="mt-1 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-700 font-mono">
                {slug ? `/blog/${slug}` : '(제목에서 자동 생성됩니다)'}
              </p>
            </div>
          </div>
        </div>

        {/* 메타데이터 (태그/카테고리) 영역 */}
        <div className="mb-12 p-6 bg-gray-50 rounded-xl border border-gray-100 relative">
          
          {/* AI 태그 생성 버튼 */}
          <div className="absolute top-4 right-4">
            <button
              onClick={handleGenerateTags}
              disabled={generatingTags}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all border ${
                generatingTags 
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-wait' 
                  : 'bg-white text-violet-600 border-violet-200 hover:bg-violet-50 hover:border-violet-300 shadow-sm'
              }`}
              title="제목과 본문을 분석해 태그를 자동 생성합니다"
            >
              {generatingTags ? (
                <>
                  <i className="ri-loader-4-line animate-spin"></i>
                  <span>분석 중...</span>
                </>
              ) : (
                <>
                  <i className="ri-sparkling-fill"></i>
                  <span>AI 태그 자동완성</span>
                </>
              )}
            </button>
          </div>

          <MetaData
            categoryId={categoryId}
            onCategoryChange={setCategoryId}
            tags={tags}
            onTagsChange={setTags}
          />
        </div>

        {/* 에디터 */}
        <BrunchTipTapEditor value={content} onChange={setContent} />
      </main>
    </div>
  );
}