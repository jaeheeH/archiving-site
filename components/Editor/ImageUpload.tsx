'use client';

import { useToast } from '@/components/ToastProvider';

interface ImageUploadProps {
  onUpload: (url: string) => void;
  onLoading: (loading: boolean) => void;
}

export default function ImageUpload({ onUpload, onLoading }: ImageUploadProps) {
  const { addToast } = useToast();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    onLoading(true);

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
      onUpload(data.url);
      addToast('이미지 업로드 완료', 'success');
    } catch (error) {
      console.error('업로드 실패:', error);
      addToast('이미지 업로드에 실패했습니다', 'error');
    } finally {
      onLoading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={handleUpload}
        style={{ display: 'none' }}
        id="image-upload"
      />
      <label
        htmlFor="image-upload"
        style={{
          display: 'inline-block',
          padding: '8px 16px',
          backgroundColor: '#007bff',
          color: 'white',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        이미지 추가
      </label>
    </div>
  );
}