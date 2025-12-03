'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import { ReadOnlyImageGalleryNode } from '@/components/Editor/ReadOnlyImageGalleryNode';
import { ReadOnlyColumnsNode } from '@/components/Editor/ReadOnlyColumnsNode';

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
      Image,
      ReadOnlyImageGalleryNode,
      ReadOnlyColumnsNode,
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
      {/* Header Image */}
      {post.title_image_url && (
        <div className="w-full h-96 bg-gray-200 overflow-hidden">
          <img
            src={post.title_image_url}
            alt={post.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Category */}
        {category && (
          <div className="mb-4">
            <span className="inline-block px-3 py-1 text-sm font-medium bg-blue-100 text-blue-700 rounded">
              {category.name}
            </span>
          </div>
        )}

        {/* Title */}
        <h1 className="text-4xl md:text-3xl font-bold text-gray-900 mb-4">
          {post.title}
        </h1>

        {/* Subtitle */}
        {post.subtitle && (
          <p className="text-xl text-gray-600 mb-6">{post.subtitle}</p>
        )}
        {/* Subtitle */}
        {post.summary && (
          <p className="text-lg text-gray-600 mb-6">{post.summary}</p>
        )}

        {/* Meta Info */}
        <div className="flex items-center gap-6 text-sm text-gray-500 mb-8 pb-8 border-b">
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

        <style jsx global>{`
          .tiptap-content .ProseMirror {
            outline: none;
            min-height: 200px;
          }

          .tiptap-content .ProseMirror > * + * {
            margin-top: 0.75em;
          }

          .tiptap-content .ProseMirror h1,
          .tiptap-content .ProseMirror h2,
          .tiptap-content .ProseMirror h3,
          .tiptap-content .ProseMirror h4,
          .tiptap-content .ProseMirror h5,
          .tiptap-content .ProseMirror h6 {
            line-height: 1.3;
            font-weight: 700;
            margin-top: 1.5em;
            margin-bottom: 0.5em;
          }

          .tiptap-content .ProseMirror h1 {
            font-size: 2em;
          }

          .tiptap-content .ProseMirror h2 {
            font-size: 1.5em;
          }

          .tiptap-content .ProseMirror h3 {
            font-size: 1.25em;
          }

          .tiptap-content .ProseMirror p {
            margin: 0;
            line-height: 1.7;
          }

          .tiptap-content .ProseMirror ul,
          .tiptap-content .ProseMirror ol {
            padding-left: 1.5em;
            margin: 1em 0;
          }

          .tiptap-content .ProseMirror li {
            margin: 0.5em 0;
          }

          .tiptap-content .ProseMirror code {
            background-color: #f3f4f6;
            padding: 0.2em 0.4em;
            border-radius: 0.25em;
            font-size: 0.9em;
            font-family: 'Courier New', Courier, monospace;
          }

          .tiptap-content .ProseMirror pre {
            background-color: #1e293b;
            color: #e2e8f0;
            padding: 1em;
            border-radius: 0.5em;
            overflow-x: auto;
            margin: 1.5em 0;
          }

          .tiptap-content .ProseMirror pre code {
            background: none;
            color: inherit;
            padding: 0;
            font-size: 0.875em;
          }

          .tiptap-content .ProseMirror blockquote {
            border-left: 4px solid #e5e7eb;
            padding-left: 1em;
            margin: 1.5em 0;
            color: #6b7280;
            font-style: italic;
          }

          .tiptap-content .ProseMirror img {
            max-width: 100%;
            height: auto;
            border-radius: 0.5em;
            margin: 1.5em 0;
          }

          .tiptap-content .ProseMirror a {
            color: #3b82f6;
            text-decoration: underline;
          }

          .tiptap-content .ProseMirror a:hover {
            color: #2563eb;
          }

          .tiptap-content .ProseMirror strong {
            font-weight: 700;
          }

          .tiptap-content .ProseMirror em {
            font-style: italic;
          }

          .tiptap-content .ProseMirror u {
            text-decoration: underline;
          }
        `}</style>

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
