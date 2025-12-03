'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { JSONContent } from '@tiptap/react';
import TipTapEditor from './TipTapEditor';
import { generateSlug } from '@/lib/slugify';
import { useToast } from '@/components/ToastProvider';

interface WriteEditorProps {
  type?: 'blog' | 'magazine' | 'news';
  postId?: string;
}

export default function WriteEditor({ type = 'blog', postId }: WriteEditorProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [titleImageUrl, setTitleImageUrl] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [imageLayout, setImageLayout] = useState<'grid' | 'swiper'>('grid');
  const [content, setContent] = useState<JSONContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingTitleImage, setUploadingTitleImage] = useState(false);

  useEffect(() => {
    if (postId) {
      const loadPost = async () => {
        try {
          const res = await fetch(`/api/posts/${postId}`);
          const data = await res.json();
          setTitle(data.data.title);
          setSubtitle(data.data.subtitle || '');
          setTitleImageUrl(data.data.title_image_url || '');
          setImages(data.data.images || []);
          setContent(data.data.content);
        } catch (error) {
          console.error('포스트 로드 실패:', error);
          addToast('포스트 로드에 실패했습니다', 'error');
        }
      };
      loadPost();
    }
  }, [postId, addToast]);

  const handleSave = async (isPublish: boolean = false) => {
    setLoading(true);

    try {
      if (!title || !content) {
        addToast('제목과 내용은 필수입니다', 'error');
        setLoading(false);
        return;
      }

      const slug = generateSlug(title, true);

      const requestData = {
        type,
        title,
        subtitle: subtitle || null,
        slug,
        content,
        title_style: titleImageUrl ? 'image' : 'text',
        title_image_url: titleImageUrl || null,
        category_id: null,
        tags: [],
        is_published: isPublish,
        author_id: null,
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
        addToast(
          isPublish ? '포스트가 발행되었습니다!' : '포스트가 저장되었습니다!',
          'success'
        );

        setTimeout(() => {
          router.push('/dashboard/contents/blog');
        }, 1500);
      } else {
        // 401 에러면 로그인 페이지로 리다이렉트
        if (response.status === 401 || result.requiresAuth) {
          addToast('로그인이 필요합니다', 'error');
          setTimeout(() => {
            router.push('/login');
          }, 1000);
        } else {
          addToast(`에러: ${result.error}`, 'error');
        }
      }
    } catch (error) {
      addToast(`요청 실패: ${error}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* 상단 헤더 - Brunch 스타일 */}
      <div className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-10">
        <div className="max-w-[700px] mx-auto px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => router.push('/dashboard/contents/blog')}
            className="text-gray-600 hover:text-gray-900 transition"
          >
            <i className="ri-arrow-left-line text-xl"></i>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSave(false)}
              disabled={loading}
              className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 transition disabled:opacity-50"
            >
              {loading ? '저장 중...' : '임시저장'}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={loading}
              className="px-6 py-2 text-sm bg-[#00c4c4] text-white rounded-full hover:bg-[#00b3b3] transition disabled:opacity-50"
            >
              {loading ? '발행 중...' : '발행하기'}
            </button>
          </div>
        </div>
      </div>

      {/* 메인 에디터 영역 */}
      <div className="max-w-[700px] mx-auto px-6 pt-24 pb-20">
        {/* 제목 입력 */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목을 입력하세요"
          className="w-full text-4xl font-bold outline-none border-none mb-8 placeholder-gray-300"
          style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        />

        {/* TipTap 에디터 */}
        <TipTapEditor value={content} onChange={setContent} />
      </div>
    </div>
  );
}