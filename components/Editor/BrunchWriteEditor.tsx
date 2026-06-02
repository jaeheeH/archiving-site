'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { JSONContent } from '@tiptap/react';
import BrunchTipTapEditor from './BrunchTipTapEditor';
import { generateSlug } from '@/lib/slugify';
import { useToast } from '@/components/ToastProvider';
import MetaData from '@/components/Editor/MetaData';
import { useImageUpload } from '@/hooks/useImageUpload';
import { getErrorMessage } from '@/lib/error-message';

interface WriteEditorProps {
  type?: 'blog' | 'magazine' | 'news';
  postId?: string;
}

type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'local-saved' | 'error';

type SaveOptions = {
  silent?: boolean;
  skipSummaryGeneration?: boolean;
};

type LocalDraft = {
  version: 1;
  updatedAt: string;
  title: string;
  subtitle: string;
  summary: string;
  titleImageUrl: string;
  content: JSONContent | null;
  categoryId: string;
  tags: string[];
  slug: string;
};

function extractTextFromContent(node: JSONContent | null): string {
  if (!node) return '';

  const ownText = typeof node.text === 'string' ? node.text : '';
  const childText = node.content?.map(extractTextFromContent).join(' ') || '';

  return `${ownText} ${childText}`.trim();
}

function hasRenderableContent(node: JSONContent | null): boolean {
  if (!node) return false;
  if (typeof node.text === 'string' && node.text.trim()) return true;
  if (node.type === 'image' || node.type === 'imageGallery') return true;

  return node.content?.some(hasRenderableContent) || false;
}

function formatSavedTime(date: Date | null) {
  if (!date) return '';

  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function BrunchWriteEditor({ type = 'blog', postId }: WriteEditorProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const { uploadImage, uploading: isUploading } = useImageUpload();

  const titleImageInputRef = useRef<HTMLInputElement>(null);
  const restoredDraftRef = useRef(false);
  const draftKey = `brunch-write-draft:${type}:${postId || 'new'}`;

  // 상태 관리
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [summary, setSummary] = useState('');
  const [titleImageUrl, setTitleImageUrl] = useState('');
  const [content, setContent] = useState<JSONContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [slug, setSlug] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // ✅ 기존 is_published, published_at 저장 (수정 시 유지용)
  const [originalIsPublished, setOriginalIsPublished] = useState(false);
  const [originalPublishedAt, setOriginalPublishedAt] = useState<string | null>(null);

  // 이전 slug 기록 (수정 시 변경 감지용)
  const [previousSlug, setPreviousSlug] = useState('');

  // AI 태그 생성 로딩 상태
  const [generatingTags, setGeneratingTags] = useState(false);

  const bodyText = extractTextFromContent(content);
  const bodyCharCount = bodyText.replace(/\s/g, '').length;
  const hasBodyContent = hasRenderableContent(content);
  const isBusy = loading || isUploading || generatingTags;
  const publishChecks = [
    { label: '제목', done: !!title.trim() },
    { label: '본문', done: hasBodyContent },
    { label: '요약', done: !!summary.trim() },
    { label: '카테고리', done: !!categoryId },
    { label: '태그', done: tags.length > 0 },
    { label: '커버', done: !!titleImageUrl },
  ];
  const readyCount = publishChecks.filter((item) => item.done).length;
  const saveStatusLabel =
    loading ? '저장 중...' :
    isUploading ? '이미지 업로드 중...' :
    generatingTags ? 'AI 분석 중...' :
    saveStatus === 'dirty' ? '저장되지 않은 변경사항' :
    saveStatus === 'saved' ? `저장됨 ${formatSavedTime(lastSavedAt)}` :
    saveStatus === 'local-saved' ? `로컬 임시저장 ${formatSavedTime(lastSavedAt)}` :
    saveStatus === 'error' ? '저장 실패' :
    '작성 중';
  const hasUnsavedChanges = saveStatus === 'dirty' || saveStatus === 'error';

  const markDirty = () => {
    setSaveStatus((current) => (current === 'saving' ? current : 'dirty'));
  };

  const handleTitleChange = (nextTitle: string) => {
    setTitle(nextTitle);
    setSlug(nextTitle.trim() ? generateSlug(nextTitle, false) : '');
    markDirty();
  };

  useEffect(() => {
    if (postId || restoredDraftRef.current) return;

    restoredDraftRef.current = true;

    try {
      const rawDraft = window.localStorage.getItem(draftKey);
      if (!rawDraft) return;

      const draft = JSON.parse(rawDraft) as Partial<LocalDraft>;
      if (draft.version !== 1) return;

      const restoreTimer = window.setTimeout(() => {
        setTitle(draft.title || '');
        setSubtitle(draft.subtitle || '');
        setSummary(draft.summary || '');
        setTitleImageUrl(draft.titleImageUrl || '');
        setContent(draft.content || null);
        setCategoryId(draft.categoryId || '');
        setTags(Array.isArray(draft.tags) ? draft.tags : []);
        setSlug(draft.slug || (draft.title ? generateSlug(draft.title, false) : ''));
        setSaveStatus('local-saved');
        setLastSavedAt(draft.updatedAt ? new Date(draft.updatedAt) : new Date());
        addToast('이전 작성 내용을 복구했습니다.', 'info');
      }, 0);

      return () => window.clearTimeout(restoreTimer);
    } catch (error) {
      console.error('로컬 임시저장 복구 실패:', error);
    }
  }, [postId, draftKey, addToast]);

  useEffect(() => {
    if (postId || !restoredDraftRef.current) return;

    const hasLocalDraftContent =
      !!title.trim() ||
      !!subtitle.trim() ||
      !!summary.trim() ||
      !!titleImageUrl ||
      hasBodyContent ||
      !!categoryId ||
      tags.length > 0;

    if (!hasLocalDraftContent) {
      window.localStorage.removeItem(draftKey);
      return;
    }

    if (saveStatus !== 'dirty' && saveStatus !== 'error') return;

    const timer = window.setTimeout(() => {
      const updatedAt = new Date();
      const draft: LocalDraft = {
        version: 1,
        updatedAt: updatedAt.toISOString(),
        title,
        subtitle,
        summary,
        titleImageUrl,
        content,
        categoryId,
        tags,
        slug,
      };

      window.localStorage.setItem(draftKey, JSON.stringify(draft));
      setLastSavedAt(updatedAt);
      setSaveStatus('local-saved');
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [
    postId,
    draftKey,
    title,
    subtitle,
    summary,
    titleImageUrl,
    content,
    categoryId,
    tags,
    slug,
    saveStatus,
    hasBodyContent,
  ]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

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
        setSlug(data.slug);
        setPreviousSlug(data.slug);
        setSaveStatus('saved');
        setLastSavedAt(data.updated_at ? new Date(data.updated_at) : null);
        
        // ✅ 기존 발행 상태 저장
        setOriginalIsPublished(data.is_published || false);
        setOriginalPublishedAt(data.published_at || null);
      } catch (error) {
        console.error('포스트 로드 실패:', error);
        addToast('포스트를 불러올 수 없습니다.', 'error');
      }
    };
    loadPost();
  }, [postId, addToast]);

  // 제목 이미지 업로드 핸들러
  const handleTitleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = await uploadImage(file, 'posts/titles');
    if (url) {
      setTitleImageUrl(url);
      markDirty();
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
        markDirty();
        addToast(`✨ AI가 ${data.tags.length}개의 태그를 추천했습니다!`, 'success');
      } else {
        addToast('추천할 만한 태그를 찾지 못했습니다.', 'info');
      }

    } catch (error) {
      console.error('Tag Generation Error:', error);
      addToast(getErrorMessage(error, 'AI 태그 생성 중 오류가 발생했습니다.'), 'error');
    } finally {
      setGeneratingTags(false);
    }
  };

  // 저장/발행 핸들러
  const handleSave = async (isPublish: boolean = false, options: SaveOptions = {}) => {
    if (isBusy) return;

    if (!title.trim()) {
      if (!options.silent) addToast('제목을 입력해주세요.', 'error');
      return;
    }
    if (!hasBodyContent) {
      if (!options.silent) addToast('본문을 작성해주세요.', 'error');
      return;
    }
    if (!slug) {
      if (!options.silent) addToast('slug를 생성해주세요. (제목이 올바른지 확인하세요)', 'error');
      return;
    }

    setLoading(true);
    setSaveStatus('saving');

    try {
      // 요약이 없으면 AI 자동 생성 시도
      let finalSummary = summary;
      if (!options.skipSummaryGeneration && !finalSummary && (title || content)) {
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
            }
          }
        } catch (error) {
          console.error('요약 생성 실패 (저장은 계속 진행):', error);
        }
      }

      // ✅ 수정: 수정 시 기존 is_published, published_at 유지
      let finalIsPublished = isPublish;
      let finalPublishedAt: string | null = null;

      if (postId) {
        // 수정 중
        if (isPublish) {
          // 발행 버튼 클릭 시
          finalIsPublished = true;
          // published_at은 기존 값이 있으면 유지, 없으면 새로 설정
          finalPublishedAt = originalPublishedAt || new Date().toISOString();
        } else {
          // 저장 버튼 클릭 시
          finalIsPublished = originalIsPublished; // 기존 상태 유지
          finalPublishedAt = originalPublishedAt; // 기존 시간 유지
        }
      } else {
        // 신규 작성
        if (isPublish) {
          finalIsPublished = true;
          finalPublishedAt = new Date().toISOString();
        } else {
          finalIsPublished = false;
          finalPublishedAt = null;
        }
      }

      // 요청 데이터 구성
      const requestData = {
        type,
        title,
        subtitle: subtitle || null,
        summary: finalSummary || null,
        slug,
        content,
        title_style: titleImageUrl ? 'image' : 'text',
        title_image_url: titleImageUrl || null,
        category_id: categoryId || null,
        tags: tags,
        is_published: finalIsPublished,
        published_at: finalPublishedAt,
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
        const savedAt = new Date();
        setSaveStatus('saved');
        setLastSavedAt(savedAt);
        if (!postId) {
          window.localStorage.removeItem(draftKey);
        }

        // slug 변경 감지 메시지
        if (postId && result.slugChanged) {
          if (!options.silent) {
            addToast(
              `slug가 변경되었습니다: ${previousSlug} → ${slug}`,
              'info'
            );
          }
          setPreviousSlug(slug);
        }

        // ✨ ISR 재검증 호출 (새로 추가)
        try {
          const revalidateRes = await fetch('/api/posts/revalidate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug }),
          });

          if (!revalidateRes.ok) {
            console.warn('⚠️ ISR 재검증 실패:', await revalidateRes.text());
          }
        } catch (error) {
          console.warn('⚠️ ISR 재검증 중 오류:', error);
        }

        if (!options.silent) {
          addToast(
            isPublish ? '발행되었습니다!' : '저장되었습니다.',
            'success'
          );
        }

        if (!postId && result.data?.id && !isPublish) {
          router.replace(`/dashboard/contents/blog/${result.data.id}/edit`);
          return;
        }

        if (isPublish) {
          router.push('/dashboard/contents/blog');
        }
      } else {
        if (response.status === 401) {
          if (!options.silent) addToast('로그인이 만료되었습니다.', 'error');
          const redirectTo = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
          router.push(`/login?redirect=${redirectTo}`);
        } else {
          throw new Error(result.error || '저장 실패');
        }
      }
    } catch (error) {
      setSaveStatus('error');
      if (!options.silent) addToast(`오류 발생: ${getErrorMessage(error, '저장 실패')}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!postId || originalIsPublished) return;
    if (saveStatus !== 'dirty') return;
    if (isBusy || !title.trim() || !hasBodyContent || !slug) return;

    const timer = window.setTimeout(() => {
      void handleSave(false, {
        silent: true,
        skipSummaryGeneration: true,
      });
    }, 30000);

    return () => window.clearTimeout(timer);
  }, [
    postId,
    originalIsPublished,
    saveStatus,
    isBusy,
    title,
    subtitle,
    summary,
    titleImageUrl,
    content,
    categoryId,
    tags,
    slug,
    hasBodyContent,
  ]);

  const handleNavigateBack = () => {
    if (hasUnsavedChanges && !window.confirm('저장되지 않은 변경사항이 있습니다. 나가시겠습니까?')) {
      return;
    }

    router.back();
  };

  return (
    <div className="min-h-screen bg-white pb-16 text-gray-950">
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-[60px] max-w-[1440px] items-center justify-between px-6 lg:px-8">
          <button
            onClick={handleNavigateBack}
            className="inline-flex items-center gap-3 text-sm font-bold tracking-tight text-gray-950 transition hover:text-gray-500"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center border border-gray-200">
              <i className="ri-arrow-left-line text-lg"></i>
            </span>
            Archive<span className="text-emerald-400">+</span>
          </button>

          <div className="hidden items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-gray-400 sm:flex">
            <span
              className={`h-2 w-2 rounded-full ${
                saveStatus === 'error'
                  ? 'bg-red-500'
                  : saveStatus === 'dirty'
                    ? 'bg-amber-400'
                    : saveStatus === 'local-saved'
                      ? 'bg-sky-500'
                    : saveStatus === 'saved'
                      ? 'bg-emerald-500'
                      : 'bg-gray-300'
              }`}
            />
            <span>{saveStatusLabel}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1440px] gap-10 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <section className="min-w-0 border-r border-gray-100 pr-0 lg:pr-10">
          <div className="mb-8 ">
            <textarea
              value={title}
              onChange={(e) => {
                handleTitleChange(e.target.value);
              }}
              placeholder="제목을 입력하세요"
              rows={2}
              className="w-full resize-none bg-transparent text-[34px] font-extrabold leading-tight tracking-normal text-gray-950 outline-none placeholder:text-gray-200 md:text-[42px]"
              autoFocus
            />
            <input
              type="text"
              value={subtitle}
              onChange={(e) => {
                setSubtitle(e.target.value);
                markDirty();
              }}
              placeholder="소제목을 입력하세요"
              className="mt-4 w-full bg-transparent text-[15px] font-medium leading-7 text-gray-500 outline-none placeholder:text-gray-300"
            />
          </div>

          <div className="mb-8  border-y border-gray-100 py-5">
            <textarea
              value={summary}
              onChange={(e) => {
                setSummary(e.target.value);
                markDirty();
              }}
              placeholder="요약글"
              rows={3}
              className="w-full resize-none bg-transparent text-[14px] leading-7 text-gray-600 outline-none placeholder:text-gray-300"
            />
          </div>

          <BrunchTipTapEditor
            value={content}
            onChange={(nextContent) => {
              setContent(nextContent);
              markDirty();
            }}
          />
        </section>

        <aside className="self-start lg:sticky lg:top-[84px]">
          <div className="border border-gray-200 bg-white">
            <div className="flex items-center gap-2 border-b border-gray-100 p-4">
              <button
                onClick={() => handleSave(false)}
                disabled={isBusy}
                className="inline-flex h-10 flex-1 items-center justify-center border border-gray-900 bg-white px-4 text-xs font-bold uppercase tracking-[0.12em] text-gray-950 transition hover:bg-gray-50 disabled:opacity-50"
              >
                {loading ? '저장 중' : '임시저장'}
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={isBusy}
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 bg-gray-950 px-4 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-gray-700 disabled:opacity-50"
              >
                {loading ? <i className="ri-loader-4-line animate-spin"></i> : null}
                발행하기
              </button>
            </div>

            <div className="divide-y divide-gray-100">
              <div className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">Visibility</h2>
                  <span
                    className={`relative inline-flex h-5 w-9 items-center transition ${
                      originalIsPublished ? 'bg-gray-950' : 'bg-gray-200'
                    }`}
                    aria-label={originalIsPublished ? '공개됨' : '비공개'}
                  >
                    <span
                      className={`h-4 w-4 bg-white shadow-sm transition ${
                        originalIsPublished ? 'translate-x-4' : 'translate-x-0.5'
                      }`}
                    />
                  </span>
                </div>
                <p className="text-xs leading-5 text-gray-400">
                  {originalIsPublished ? '현재 공개된 글입니다.' : '발행 전에는 공개되지 않습니다.'}
                </p>
              </div>

              <div className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">Thumbnail</h2>
                  {titleImageUrl ? (
                    <button
                      onClick={() => {
                        setTitleImageUrl('');
                        markDirty();
                      }}
                      className="text-xs font-medium text-gray-400 hover:text-red-500"
                    >
                      제거
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => titleImageInputRef.current?.click()}
                  disabled={isUploading}
                  className="group relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden border border-gray-200 bg-gray-950 text-white transition hover:border-gray-400 disabled:opacity-60"
                >
                  {titleImageUrl ? (
                    <>
                      <img src={titleImageUrl} alt="Cover" className="h-full w-full object-cover" />
                      <span className="absolute inset-0 bg-black/20 opacity-0 transition group-hover:opacity-100" />
                    </>
                  ) : (
                    <span className="absolute inset-0 bg-[linear-gradient(135deg,#111827,#1f2937)]" />
                  )}
                  <span className="absolute inline-flex h-9 items-center justify-center bg-white px-5 text-xs font-bold uppercase tracking-[0.12em] text-gray-950 shadow-sm">
                    {isUploading ? '업로드 중' : titleImageUrl ? '변경하기' : '업로드하기'}
                  </span>
                </button>
                <input
                  ref={titleImageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleTitleImageUpload}
                  className="hidden"
                />
              </div>

              <div className="p-4">
                <MetaData
                  categoryId={categoryId}
                  onCategoryChange={(id) => {
                    setCategoryId(id);
                    markDirty();
                  }}
                  tags={tags}
                  onTagsChange={(nextTags) => {
                    setTags(nextTags);
                    markDirty();
                  }}
                />
                <button
                  onClick={handleGenerateTags}
                  disabled={generatingTags}
                  className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 border border-gray-200 bg-white text-xs font-bold uppercase tracking-[0.12em] text-gray-700 transition hover:border-gray-900 disabled:opacity-50"
                >
                  {generatingTags ? (
                    <i className="ri-loader-4-line animate-spin"></i>
                  ) : (
                    <i className="ri-sparkling-fill"></i>
                  )}
                  {generatingTags ? '분석 중' : 'AI 태그'}
                </button>
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">Checklist</h2>
                  <span className="text-[11px] font-semibold text-gray-400">
                    {readyCount}/{publishChecks.length}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {publishChecks.map((item) => (
                    <span
                      key={item.label}
                      className={`inline-flex items-center gap-1 border px-2 py-1 text-xs ${
                        item.done ? 'border-gray-900 bg-gray-950 text-white' : 'border-gray-200 bg-white text-gray-400'
                      }`}
                    >
                      <i className={item.done ? 'ri-check-line' : 'ri-circle-line'} />
                      {item.label}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-xs text-gray-400">
                  본문 {bodyCharCount.toLocaleString('ko-KR')}자
                </p>
              </div>

              <div className="p-4">
                <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">Permalink</h2>
                <div className="border border-gray-200 bg-gray-50 px-3 py-2">
                  <p className="break-all text-xs leading-5 text-gray-500">
                    {slug ? `/blog/${slug}` : '제목에서 자동 생성됩니다'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 border border-gray-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">Preview</h2>
              <span className="text-xs text-gray-400">{formatSavedTime(lastSavedAt)}</span>
            </div>
            <p className="line-clamp-2 text-sm font-semibold leading-6 text-gray-950">
              {title || '제목을 입력하세요'}
            </p>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-500">
              {summary || subtitle || '요약 또는 소제목이 여기에 표시됩니다.'}
            </p>
            {tags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {tags.slice(0, 5).map((tag) => (
                  <span key={tag} className="bg-gray-100 px-2 py-1 text-[11px] text-gray-600">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </aside>
      </main>
    </div>
  );
}
