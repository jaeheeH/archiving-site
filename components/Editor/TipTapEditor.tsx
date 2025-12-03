// components/Editor/TipTapEditor.tsx

'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { useEffect, useRef, useState } from 'react';
import type { JSONContent } from '@tiptap/react';
import { useToast } from '@/components/ToastProvider';

const lowlight = createLowlight(common);

interface TipTapEditorProps {
  value: JSONContent | null;
  onChange: (content: JSONContent) => void;
}

export default function TipTapEditor({ value, onChange }: TipTapEditorProps) {
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // 기본 코드블록 비활성화
      }),
      Image.configure({
        allowBase64: true,
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline',
        },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: {
          class: 'bg-gray-900 text-white p-4 rounded-lg overflow-x-auto',
        },
      }),
    ],
    content: value || {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '' }],
        },
      ],
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON());
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  if (!editor) {
    return <div>에디터 로딩 중...</div>;
  }

  const addLink = () => {
    const url = window.prompt('링크 URL을 입력하세요');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const timestamp = Date.now();
      const fileName = `${timestamp}-${file.name}`;
      const filePath = `posts/${fileName}`;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', filePath);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('업로드 실패');
      }

      const data = await response.json();
      editor.chain().focus().setImage({ src: data.url }).run();
      addToast('이미지가 추가되었습니다', 'success');
    } catch (error) {
      console.error('이미지 업로드 실패:', error);
      addToast('이미지 업로드에 실패했습니다', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const triggerImageUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div style={{ border: '1px solid #ccc', borderRadius: '8px' }}>
      <div style={{ padding: '10px', borderBottom: '1px solid #eee', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
        {/* 텍스트 스타일 */}
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          style={{ padding: '5px 10px', cursor: 'pointer', backgroundColor: editor.isActive('bold') ? '#ddd' : '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
          title="굵게"
        >
          <i className="ri-bold"></i>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          style={{ padding: '5px 10px', cursor: 'pointer', backgroundColor: editor.isActive('italic') ? '#ddd' : '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
          title="기울임"
        >
          <i className="ri-italic"></i>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          style={{ padding: '5px 10px', cursor: 'pointer', backgroundColor: editor.isActive('underline') ? '#ddd' : '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
          title="밑줄"
        >
          <i className="ri-underline"></i>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          style={{ padding: '5px 10px', cursor: 'pointer', backgroundColor: editor.isActive('strike') ? '#ddd' : '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
          title="취소선"
        >
          <i className="ri-strikethrough"></i>
        </button>

        <div style={{ width: '1px', backgroundColor: '#ccc', margin: '0 5px' }}></div>

        {/* 헤딩 */}
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          style={{ padding: '5px 10px', cursor: 'pointer', backgroundColor: editor.isActive('heading', { level: 1 }) ? '#ddd' : '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
          title="헤딩 1"
        >
          <i className="ri-h-1"></i>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          style={{ padding: '5px 10px', cursor: 'pointer', backgroundColor: editor.isActive('heading', { level: 2 }) ? '#ddd' : '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
          title="헤딩 2"
        >
          <i className="ri-h-2"></i>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          style={{ padding: '5px 10px', cursor: 'pointer', backgroundColor: editor.isActive('heading', { level: 3 }) ? '#ddd' : '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
          title="헤딩 3"
        >
          <i className="ri-h-3"></i>
        </button>

        <div style={{ width: '1px', backgroundColor: '#ccc', margin: '0 5px' }}></div>

        {/* 정렬 */}
        <button
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          style={{ padding: '5px 10px', cursor: 'pointer', backgroundColor: editor.isActive({ textAlign: 'left' }) ? '#ddd' : '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
          title="왼쪽 정렬"
        >
          <i className="ri-align-left"></i>
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          style={{ padding: '5px 10px', cursor: 'pointer', backgroundColor: editor.isActive({ textAlign: 'center' }) ? '#ddd' : '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
          title="가운데 정렬"
        >
          <i className="ri-align-center"></i>
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          style={{ padding: '5px 10px', cursor: 'pointer', backgroundColor: editor.isActive({ textAlign: 'right' }) ? '#ddd' : '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
          title="오른쪽 정렬"
        >
          <i className="ri-align-right"></i>
        </button>

        <div style={{ width: '1px', backgroundColor: '#ccc', margin: '0 5px' }}></div>

        {/* 리스트 */}
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          style={{ padding: '5px 10px', cursor: 'pointer', backgroundColor: editor.isActive('bulletList') ? '#ddd' : '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
          title="순서 없는 목록"
        >
          <i className="ri-list-unordered"></i>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          style={{ padding: '5px 10px', cursor: 'pointer', backgroundColor: editor.isActive('orderedList') ? '#ddd' : '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
          title="순서 있는 목록"
        >
          <i className="ri-list-ordered"></i>
        </button>

        <div style={{ width: '1px', backgroundColor: '#ccc', margin: '0 5px' }}></div>

        {/* 인용구 & 코드 */}
        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          style={{ padding: '5px 10px', cursor: 'pointer', backgroundColor: editor.isActive('blockquote') ? '#ddd' : '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
          title="인용구"
        >
          <i className="ri-double-quotes-l"></i>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          style={{ padding: '5px 10px', cursor: 'pointer', backgroundColor: editor.isActive('codeBlock') ? '#ddd' : '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
          title="코드 블록"
        >
          <i className="ri-code-box-line"></i>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCode().run()}
          style={{ padding: '5px 10px', cursor: 'pointer', backgroundColor: editor.isActive('code') ? '#ddd' : '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
          title="인라인 코드"
        >
          <i className="ri-code-line"></i>
        </button>

        <div style={{ width: '1px', backgroundColor: '#ccc', margin: '0 5px' }}></div>

        {/* 링크 & 이미지 */}
        <button
          onClick={addLink}
          style={{ padding: '5px 10px', cursor: 'pointer', backgroundColor: editor.isActive('link') ? '#ddd' : '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
          title="링크 추가"
        >
          <i className="ri-link"></i>
        </button>
        <button
          onClick={triggerImageUpload}
          disabled={uploading}
          style={{
            padding: '5px 10px',
            cursor: uploading ? 'not-allowed' : 'pointer',
            backgroundColor: uploading ? '#f0f0f0' : '#fff',
            border: '1px solid #ccc',
            borderRadius: '4px',
            opacity: uploading ? 0.6 : 1
          }}
          title={uploading ? '업로드 중...' : '이미지 추가'}
        >
          <i className={uploading ? 'ri-loader-4-line animate-spin' : 'ri-image-add-line'}></i>
        </button>

        <div style={{ width: '1px', backgroundColor: '#ccc', margin: '0 5px' }}></div>

        {/* 구분선 */}
        <button
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          style={{ padding: '5px 10px', cursor: 'pointer', backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
          title="구분선"
        >
          <i className="ri-separator"></i>
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        style={{ display: 'none' }}
      />

      <EditorContent
        editor={editor}
        style={{ padding: '15px', minHeight: '300px', outline: 'none' }}
        className="prose max-w-none"
      />
    </div>
  );
}