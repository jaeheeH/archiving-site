'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageExtension from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';

import { ReadOnlyImageGalleryNode } from '@/components/Editor/ReadOnlyImageGalleryNode';
import { ReadOnlyColumnsNode } from '@/components/Editor/ReadOnlyColumnsNode';
import { optimizeImageUrl } from '@/lib/image-optimizer';
import '../../css/blog/view.scss';

interface Post {
  id: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  content: any;
  slug: string;
  published_at: string | null;
  created_at: string;
  title_image_url: string | null;
  category_id: string | null;
  view_count: number;
  scrap_count: number;
}

interface Category {
  id: string;
  name: string;
}

export default function BlogDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [post, setPost] = useState<Post | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);

  const editor = useEditor({
    extensions: [
      StarterKit as any,
      ImageExtension,
      ReadOnlyImageGalleryNode,
      ReadOnlyColumnsNode,
      Table.configure({
        resizable: true,
        handleWidth: 4,
        cellMinWidth: 50,
        lastColumnResizable: true,
        allowTableNodeSelection: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Link.configure({
        openOnClick: true,
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph', 'image', 'imageGallery'],
      }),
    ],
    editable: false,
    immediatelyRender: false,
    content: '',
  });

  useEffect(() => {
    fetchPost();
  }, [slug]);

  useEffect(() => {
    if (post?.content && editor && editor.isEmpty) {
      console.log('Setting editor content:', post.content);
      setTimeout(() => {
        editor.commands.setContent(post.content);
      }, 0);
    }
  }, [post, editor]);

  useEffect(() => {
    if (post?.category_id) {
      fetchCategory(post.category_id);
    }
  }, [post?.category_id]);

  // 에디터 렌더링 후 이미지 최적화
  useEffect(() => {
    const optimizeEditorImages = () => {
      try {
        const images = document.querySelectorAll('.tiptap-content img');
        console.log('Found images:', images.length);
        
        images.forEach((img: Element) => {
          const src = img.getAttribute('src');
          if (src && src.includes('supabase.co')) {
            // WebP로 최적화된 URL 생성
            const optimizedSrc = optimizeImageUrl(src, {
              width: 1000,
              format: 'webp',
              quality: 75,
            });
            
            // 반응형 srcset 생성
            const srcset = [
              `${optimizeImageUrl(src, { width: 400, format: 'webp', quality: 75 })} 400w`,
              `${optimizeImageUrl(src, { width: 800, format: 'webp', quality: 75 })} 800w`,
              `${optimizeImageUrl(src, { width: 1200, format: 'webp', quality: 75 })} 1200w`,
            ].join(', ');
            
            // 속성 적용
            img.setAttribute('src', optimizedSrc);
            img.setAttribute('srcset', srcset);
            img.setAttribute('sizes', '(max-width: 640px) 100vw, (max-width: 1024px) 800px, 1200px');
            img.setAttribute('loading', 'lazy');
            img.setAttribute('decoding', 'async');
            
            console.log('Optimized image:', {
              original: src,
              optimized: optimizedSrc,
            });
          }
        });
      } catch (error) {
        console.warn('Image optimization failed:', error);
      }
    };

    // 에디터 렌더링 완료 후 최적화
    const timer = setTimeout(optimizeEditorImages, 300);
    return () => clearTimeout(timer);
  }, [post?.content]);

  const fetchPost = async () => {
    try {
      const res = await fetch(`/api/posts/slug/${slug}?type=blog`);
      const data = await res.json();

      if (!data.data || !data.data.is_published) {
        router.push('/blog');
        return;
      }

      setPost(data.data);
    } catch (error) {
      console.error('Failed to fetch post:', error);
      router.push('/blog');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategory = async (categoryId: string) => {
    try {
      const res = await fetch('/api/posts/categories?type=blog');
      const data = await res.json();
      const foundCategory = (data.categories || []).find((c: Category) => c.id === categoryId);
      setCategory(foundCategory || null);
    } catch (error) {
      console.error('Failed to fetch category:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (!post) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Image - Next.js Image 최적화 */}
      {post.title_image_url && (
        <div className="relative w-full h-56 md:h-80 lg:h-96 bg-gray-200 overflow-hidden">
          <Image
            src={post.title_image_url}
            alt={post.title}
            fill
            sizes="100vw"
            className="object-cover"
            priority
            quality={75}
            placeholder="blur"
            blurDataURL="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3Crect fill='%23d1d5db' width='16' height='9'/%3E%3C/svg%3E"
          />
        </div>
      )}

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-12 article-editor">
        {/* Category */}
        {category && (
          <div className="mb-4">
            <span className="inline-block px-3 py-1 text-sm font-medium bg-blue-100 text-blue-700 rounded">
              {category.name}
            </span>
          </div>
        )}

        {/* Subtitle */}
        {post.subtitle && (
          <p className=" text-gray-600 mb-2">{post.subtitle}</p>
        )}
        
        {/* Title */}
        <h1 className="text-2xl md:text-2xl font-bold text-gray-900 mb-4">
          {post.title}
        </h1>

        {/* Summary */}
        {post.summary && (
          <p className=" text-gray-600 mb-6">{post.summary}</p>
        )}

        {/* Meta Info */}
        <div className="flex items-center gap-6 text-sm text-gray-500 mb-8 pb-8 border-b flex-wrap">
          <span>
            {new Date(post.published_at || post.created_at).toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
          <span className="flex items-center gap-1">
            <i className="ri-eye-line"></i>
            조회 {post.view_count || 0}
          </span>
          <span className="flex items-center gap-1">
            <i className="ri-bookmark-line"></i>
            스크랩 {post.scrap_count || 0}
          </span>
        </div>

        {/* Article Content */}
        <article className="prose prose-lg max-w-none">
          <div className="tiptap-content">
            <EditorContent editor={editor} />
          </div>
        </article>

        {/* Back Button */}
        <div className="mt-12 pt-8 border-t">
          <button
            onClick={() => router.push('/blog')}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition flex items-center gap-2"
          >
            <i className="ri-arrow-left-line"></i>
            목록으로
          </button>
        </div>
      </div>
    </div>
  );
}