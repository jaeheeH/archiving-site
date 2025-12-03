'use client';

import { useState } from 'react';
import { useToast } from '@/components/ToastProvider';

interface TitleSectionProps {
  title: string;
  onTitleChange: (title: string) => void;
  titleStyle: 'text' | 'image';
  onTitleStyleChange: (style: 'text' | 'image') => void;
  titleImageUrl: string;
  onTitleImageChange: (url: string) => void;
}

export default function TitleSection({
  title,
  onTitleChange,
  titleStyle,
  onTitleStyleChange,
  titleImageUrl,
  onTitleImageChange,
}: TitleSectionProps) {
  const [uploading, setUploading] = useState(false);
  const { addToast } = useToast();

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const timestamp = Date.now();
      const fileName = `${timestamp}-${file.name}`;
      const filePath = `posts/titles/${fileName}`;

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
      onTitleImageChange(data.url);
      addToast('제목 이미지 업로드 완료', 'success');
    } catch (error) {
      console.error('제목 이미지 업로드 실패:', error);
      addToast('이미지 업로드에 실패했습니다', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>제목:</label>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="제목을 입력하세요"
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '20px',
            fontWeight: 'bold',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>제목 스타일:</label>
        <select
          value={titleStyle}
          onChange={(e) => onTitleStyleChange(e.target.value as 'text' | 'image')}
          style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
        >
          <option value="text">텍스트</option>
          <option value="image">이미지</option>
        </select>
      </div>

      {titleStyle === 'image' && (
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>제목 이미지:</label>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: 'none' }}
              id="title-image-upload"
              disabled={uploading}
            />
            <label
              htmlFor="title-image-upload"
              style={{
                display: 'inline-block',
                padding: '8px 16px',
                backgroundColor: uploading ? '#ccc' : '#007bff',
                color: 'white',
                borderRadius: '4px',
                cursor: uploading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
              }}
            >
              {uploading ? '업로드 중...' : '파일 업로드'}
            </label>

            <input
              type="text"
              value={titleImageUrl}
              onChange={(e) => onTitleImageChange(e.target.value)}
              placeholder="또는 이미지 URL을 입력하세요"
              style={{
                flex: 1,
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {titleImageUrl && (
            <div style={{ marginTop: '10px' }}>
              <img
                src={titleImageUrl}
                alt="제목 이미지 미리보기"
                style={{
                  maxWidth: '100%',
                  maxHeight: '200px',
                  borderRadius: '8px',
                  border: '1px solid #ddd',
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}