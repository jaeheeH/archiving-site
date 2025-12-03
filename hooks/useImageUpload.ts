import { useState } from 'react';
import { useToast } from '@/components/ToastProvider';

interface UseImageUploadResult {
  uploadImage: (file: File, folder?: string, isTemp?: boolean) => Promise<string | null>;
  uploading: boolean;
}

export function useImageUpload(): UseImageUploadResult {
  const [uploading, setUploading] = useState(false);
  const { addToast } = useToast();

  const uploadImage = async (file: File, folder: string = 'posts', isTemp: boolean = true) => {
    if (!file) return null;

    setUploading(true);
    try {
      const timestamp = Date.now();
      const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${timestamp}-${safeFileName}`;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', fileName);
      formData.append('isTemp', isTemp ? 'true' : 'false');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('업로드 실패');
      }

      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error('이미지 업로드 실패:', error);
      addToast('이미지 업로드에 실패했습니다', 'error');
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { uploadImage, uploading };
}