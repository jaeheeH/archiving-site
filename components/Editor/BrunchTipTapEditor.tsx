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
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';

import { useEffect, useRef, useState } from 'react';
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
  const [showTableMenu, setShowTableMenu] = useState(false);

  const editor = useEditor({
    extensions: [
      (StarterKit.configure({
        horizontalRule: false,
        dropcursor: {
          color: '#00c4c4',
          width: 2,
        },
      }) as any),
      BubbleMenuExtension,
      HorizontalRule.configure({
        HTMLAttributes: {
          class: 'my-8 border-t border-gray-300 w-1/2 mx-auto',
        },
      }),
      Placeholder.configure({
        placeholder: '본문을 입력하세요...',
        emptyEditorClass:
          'is-editor-empty before:content-[attr(data-placeholder)] before:text-gray-300 before:float-left before:pointer-events-none',
      }),
      // 커스텀 노드
      DraggableImage,
      ImageGalleryNode,
      ColumnsNode,
      
      // 테이블 확장 추가
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
    content: value,
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

  // 메뉴 밖 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.table-menu')) {
        setShowTableMenu(false);
      }
    };

    if (showTableMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showTableMenu]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !editor) return;

    try {
      const uploadPromises = files.map((file) => uploadImage(file, 'posts/content'));
      const results = await Promise.all(uploadPromises);
      const validUrls = results.filter((url): url is string => url !== null);

      if (validUrls.length === 0) return;

      if (validUrls.length === 1) {
        editor.chain().focus().setImage({ src: validUrls[0] }).run();
      } else {
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
        
        editor.chain().focus().enter().run();
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
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
    <div className="relative article-editor">
      {/* 1. 버블 메뉴 */}
      {editor && (
        <BubbleMenu
          editor={editor}
          tippyOptions={{ duration: 100 }}
          className="bg-white shadow-lg border border-gray-200 rounded-lg flex overflow-hidden p-1 gap-1"
        >
          <button
            onClick={() => (editor as any).chain().focus().toggleBold().run()}
            className={`p-2 hover:bg-gray-100 rounded ${
              editor.isActive('bold') ? 'text-blue-500 bg-blue-50' : 'text-gray-600'
            }`}
          >
            <i className="ri-bold"></i>
          </button>
          <button
            onClick={() => (editor as any).chain().focus().toggleItalic().run()}
            className={`p-2 hover:bg-gray-100 rounded ${
              editor.isActive('italic') ? 'text-blue-500 bg-blue-50' : 'text-gray-600'
            }`}
          >
            <i className="ri-italic"></i>
          </button>
          <button
            onClick={() => (editor as any).chain().focus().toggleUnderline().run()}
            className={`p-2 hover:bg-gray-100 rounded ${
              editor.isActive('underline') ? 'text-blue-500 bg-blue-50' : 'text-gray-600'
            }`}
          >
            <i className="ri-underline"></i>
          </button>
          <div className="w-px h-6 bg-gray-200 my-auto mx-1"></div>
          <button
            onClick={() => (editor as any).chain().focus().toggleHeading({ level: 2 }).run()}
            className={`p-2 hover:bg-gray-100 rounded ${
              editor.isActive('heading', { level: 2 }) ? 'text-blue-500 bg-blue-50' : 'text-gray-600'
            }`}
          >
            <i className="ri-h-2"></i>
          </button>
          <button
            onClick={() => (editor as any).chain().focus().toggleHeading({ level: 3 }).run()}
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
              if (url) (editor as any).chain().focus().setLink({ href: url }).run();
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
          onClick={() => (editor as any).chain().focus().setHorizontalRule().run()}
          className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition"
          title="구분선 추가"
        >
          <i className="ri-separator"></i>
        </button>

        {/* 2단 레이아웃 버튼 */}
        <button
          onClick={() => (editor as any).chain().focus().setColumns({ columns: 2 }).run()}
          className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition"
          title="2단 레이아웃"
        >
          <i className="ri-layout-column-line"></i>
        </button>

        {/* 테이블 드롭다운 */}
        <div className="relative table-menu">
          <button
            onClick={() => setShowTableMenu(!showTableMenu)}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition"
            title="테이블 삽입"
          >
            <i className="ri-table-2"></i>
          </button>
          
          {/* 드롭다운 메뉴 */}
          {showTableMenu && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-50 w-40">
              <button
                onClick={() => {
                  (editor as any)
                    .chain()
                    .focus()
                    .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                    .run();
                  setShowTableMenu(false);
                }}
                className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
              >
                <i className="ri-table-2 mr-2"></i>테이블 삽입
              </button>
              <button
                onClick={() => {
                  (editor as any).chain().focus().addRowAfter().run();
                  setShowTableMenu(false);
                }}
                className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm border-t"
                disabled={!editor.isActive('table')}
              >
                <i className="ri-arrow-down-line mr-2"></i>행 추가
              </button>
              <button
                onClick={() => {
                  (editor as any).chain().focus().addColumnAfter().run();
                  setShowTableMenu(false);
                }}
                className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm border-t"
                disabled={!editor.isActive('table')}
              >
                <i className="ri-arrow-right-line mr-2"></i>열 추가
              </button>
              <button
                onClick={() => {
                  (editor as any).chain().focus().deleteRow().run();
                  setShowTableMenu(false);
                }}
                className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm border-t text-red-600"
                disabled={!editor.isActive('table')}
              >
                <i className="ri-delete-row mr-2"></i>행 삭제
              </button>
              <button
                onClick={() => {
                  (editor as any).chain().focus().deleteColumn().run();
                  setShowTableMenu(false);
                }}
                className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-red-600"
                disabled={!editor.isActive('table')}
              >
                <i className="ri-delete-column mr-2"></i>열 삭제
              </button>
              <button
                onClick={() => {
                  (editor as any).chain().focus().deleteTable().run();
                  setShowTableMenu(false);
                }}
                className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm border-t text-red-600"
                disabled={!editor.isActive('table')}
              >
                <i className="ri-delete-bin-line mr-2"></i>테이블 삭제
              </button>
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-gray-200 mx-2"></div>

        {/* 인용구 */}
        <button
          onClick={() => (editor as any).chain().focus().toggleBlockquote().run()}
          className={`p-2 hover:bg-gray-100 rounded transition ${
            editor.isActive('blockquote') ? 'text-blue-500 bg-blue-50' : 'text-gray-500'
          }`}
          title="인용구"
        >
          <i className="ri-double-quotes-l"></i>
        </button>

        {/* 코드블록 */}
        <button
          onClick={() => (editor as any).chain().focus().toggleCodeBlock().run()}
          className={`p-2 hover:bg-gray-100 rounded transition ${
            editor.isActive('codeBlock') ? 'text-blue-500 bg-blue-50' : 'text-gray-500'
          }`}
          title="코드블록"
        >
          <i className="ri-code-box-line"></i>
        </button>

        <div className="w-px h-5 bg-gray-200 mx-2"></div>

        {/* 글머리 기호 */}
        <button
          onClick={() => (editor as any).chain().focus().toggleBulletList().run()}
          className={`p-2 hover:bg-gray-100 rounded transition ${
            editor.isActive('bulletList') ? 'text-blue-500 bg-blue-50' : 'text-gray-500'
          }`}
          title="글머리 기호 목록"
        >
          <i className="ri-list-unordered"></i>
        </button>

        {/* 번호 매기기 */}
        <button
          onClick={() => (editor as any).chain().focus().toggleOrderedList().run()}
          className={`p-2 hover:bg-gray-100 rounded transition ${
            editor.isActive('orderedList') ? 'text-blue-500 bg-blue-50' : 'text-gray-500'
          }`}
          title="번호 매기기 목록"
        >
          <i className="ri-list-ordered"></i>
        </button>

        <div className="w-px h-5 bg-gray-200 mx-2"></div>

        {/* 정렬 버튼 그룹 */}
        <button
          onClick={() => (editor as any).chain().focus().setTextAlign('left').run()}
          className={`p-2 hover:bg-gray-100 rounded ${
            editor.isActive({ textAlign: 'left' }) ? 'text-black' : 'text-gray-400'
          }`}
        >
          <i className="ri-align-left"></i>
        </button>
        <button
          onClick={() => (editor as any).chain().focus().setTextAlign('center').run()}
          className={`p-2 hover:bg-gray-100 rounded ${
            editor.isActive({ textAlign: 'center' }) ? 'text-black' : 'text-gray-400'
          }`}
        >
          <i className="ri-align-center"></i>
        </button>
        <button
          onClick={() => (editor as any).chain().focus().setTextAlign('right').run()}
          className={`p-2 hover:bg-gray-100 rounded ${
            editor.isActive({ textAlign: 'right' }) ? 'text-black' : 'text-gray-400'
          }`}
        >
          <i className="ri-align-right"></i>
        </button>
      </div>

      {/* 3. 파일 입력 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleImageUpload}
        className="hidden"
      />

      <EditorContent editor={editor} />
    </div>
  );
}