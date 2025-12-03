'use client';

import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import BubbleMenuExtension from '@tiptap/extension-bubble-menu';

import { useEffect, useRef } from 'react';
import type { JSONContent } from '@tiptap/react';
import { useImageUpload } from '@/hooks/useImageUpload';
import { DraggableImage } from './DraggableImageNode';
import { ImageGalleryNode } from './ImageGalleryNode';
import { ColumnsNode } from './ColumnsNode';

interface BrunchTipTapEditorProps {
  value: JSONContent | null;
  onChange: (content: JSONContent) => void;
}

export default function BrunchTipTapEditor({ value, onChange }: BrunchTipTapEditorProps) {
  const { uploadImage, uploading } = useImageUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        horizontalRule: false, // 기본 구분선 끄기 (아래 커스텀 설정 사용)
        dropcursor: {
          color: '#00c4c4',
          width: 2,
        },
      }),
      // BubbleMenu 확장 등록 (필수)
      BubbleMenuExtension,
      HorizontalRule.configure({
        HTMLAttributes: {
          class: 'my-8 border-t border-gray-300 w-1/2 mx-auto', // 중앙 정렬 스타일
        },
      }),
      Placeholder.configure({
        placeholder: '본문을 입력하세요...',
        emptyEditorClass:
          'is-editor-empty before:content-[attr(data-placeholder)] before:text-gray-300 before:float-left before:pointer-events-none',
      }),
      // 커스텀 노드 등록
      DraggableImage,
      ImageGalleryNode,
      ColumnsNode,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline cursor-pointer',
        },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph', 'image', 'imageGallery'],
      }),
    ],
    content: value, // 초기값 (비동기 데이터는 useEffect로 처리)
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none min-h-[500px]',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON());
    },
    immediatelyRender: false,
  });

  // [수정됨] 비동기 데이터 로드 시 에디터 내용 업데이트 (flushSync 에러 방지)
  useEffect(() => {
    if (editor && value && editor.isEmpty) {
      setTimeout(() => {
        if (editor.isEmpty) {
          editor.commands.setContent(value);
        }
      }, 0);
    }
  }, [editor, value]);

  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  // [수정됨] 이미지 업로드 핸들러 (다중 파일 지원 & 갤러리 자동 변환)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !editor) return;

    try {
      // 1. 모든 이미지를 병렬 업로드
      const uploadPromises = files.map((file) => uploadImage(file, 'posts/content'));
      const results = await Promise.all(uploadPromises);
      const validUrls = results.filter((url): url is string => url !== null);

      if (validUrls.length === 0) return;

      // 2. 개수에 따른 처리
      if (validUrls.length === 1) {
        // 단일 이미지 -> 일반 이미지 노드
        editor.chain().focus().setImage({ src: validUrls[0] }).run();
      } else {
        // 다중 이미지 -> 갤러리 노드
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'imageGallery',
            attrs: {
              images: validUrls,
              layout: 'grid',
            },
          })
          .run();
        
        // 갤러리 뒤에 빈 줄 추가 (작성 편의성)
        editor.chain().focus().enter().run();
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      // 입력 초기화
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (!editor) {
    return (
      <div className="h-[500px] flex items-center justify-center text-gray-400">
        에디터 로딩 중...
      </div>
    );
  }

  return (
    <div className="relative">
      {/* 1. 버블 메뉴 (드래그 시 등장) */}
      {editor && (
        <BubbleMenu
          editor={editor}
          tippyOptions={{ duration: 100 }}
          className="bg-white shadow-lg border border-gray-200 rounded-lg flex overflow-hidden p-1 gap-1"
        >
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-2 hover:bg-gray-100 rounded ${
              editor.isActive('bold') ? 'text-blue-500 bg-blue-50' : 'text-gray-600'
            }`}
          >
            <i className="ri-bold"></i>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-2 hover:bg-gray-100 rounded ${
              editor.isActive('italic') ? 'text-blue-500 bg-blue-50' : 'text-gray-600'
            }`}
          >
            <i className="ri-italic"></i>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`p-2 hover:bg-gray-100 rounded ${
              editor.isActive('underline') ? 'text-blue-500 bg-blue-50' : 'text-gray-600'
            }`}
          >
            <i className="ri-underline"></i>
          </button>
          <div className="w-px h-6 bg-gray-200 my-auto mx-1"></div>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`p-2 hover:bg-gray-100 rounded ${
              editor.isActive('heading', { level: 2 }) ? 'text-blue-500 bg-blue-50' : 'text-gray-600'
            }`}
          >
            <i className="ri-h-2"></i>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`p-2 hover:bg-gray-100 rounded ${
              editor.isActive('heading', { level: 3 }) ? 'text-blue-500 bg-blue-50' : 'text-gray-600'
            }`}
          >
            <i className="ri-h-3"></i>
          </button>
          <div className="w-px h-6 bg-gray-200 my-auto mx-1"></div>
          <button
            onClick={() => {
              const url = window.prompt('URL을 입력하세요');
              if (url) editor.chain().focus().setLink({ href: url }).run();
            }}
            className={`p-2 hover:bg-gray-100 rounded ${
              editor.isActive('link') ? 'text-blue-500 bg-blue-50' : 'text-gray-600'
            }`}
          >
            <i className="ri-link"></i>
          </button>
        </BubbleMenu>
      )}

      {/* 2. 상단 고정 툴바 */}
      <div className="sticky top-[60px] z-40 bg-white/90 backdrop-blur border-b border-gray-100 py-2 mb-8 flex flex-wrap gap-1 items-center transition-all">
        {/* 이미지 추가 버튼 */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition relative"
          title="이미지 추가"
        >
          {uploading ? (
            <i className="ri-loader-4-line animate-spin"></i>
          ) : (
            <i className="ri-image-add-line"></i>
          )}
        </button>

        {/* 구분선 추가 버튼 */}
        <button
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition"
          title="구분선 추가"
        >
          <i className="ri-separator"></i>
        </button>

        {/* 2단 레이아웃 버튼 */}
        <button
          onClick={() => editor.chain().focus().setColumns({ columns: 2 }).run()}
          className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition"
          title="2단 레이아웃"
        >
          <i className="ri-layout-column-line"></i>
        </button>

        <div className="w-px h-5 bg-gray-200 mx-2"></div>

        {/* 인용구 */}
        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-2 hover:bg-gray-100 rounded transition ${
            editor.isActive('blockquote') ? 'text-blue-500 bg-blue-50' : 'text-gray-500'
          }`}
          title="인용구"
        >
          <i className="ri-double-quotes-l"></i>
        </button>

        {/* 코드블록 */}
        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`p-2 hover:bg-gray-100 rounded transition ${
            editor.isActive('codeBlock') ? 'text-blue-500 bg-blue-50' : 'text-gray-500'
          }`}
          title="코드블록"
        >
          <i className="ri-code-box-line"></i>
        </button>

        <div className="w-px h-5 bg-gray-200 mx-2"></div>

        {/* 정렬 버튼 그룹 */}
        <button
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`p-2 hover:bg-gray-100 rounded ${
            editor.isActive({ textAlign: 'left' }) ? 'text-black' : 'text-gray-400'
          }`}
        >
          <i className="ri-align-left"></i>
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`p-2 hover:bg-gray-100 rounded ${
            editor.isActive({ textAlign: 'center' }) ? 'text-black' : 'text-gray-400'
          }`}
        >
          <i className="ri-align-center"></i>
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={`p-2 hover:bg-gray-100 rounded ${
            editor.isActive({ textAlign: 'right' }) ? 'text-black' : 'text-gray-400'
          }`}
        >
          <i className="ri-align-right"></i>
        </button>
      </div>

      {/* 3. 파일 입력 (다중 선택 가능) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple // [중요] 다중 파일 선택 활성화
        onChange={handleImageUpload}
        className="hidden"
      />

      <EditorContent editor={editor} />
    </div>
  );
}