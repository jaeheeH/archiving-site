import { useRef, useState } from 'react';
import { uploadImageFile } from '@/lib/upload-image-client';

import { useToast } from '@/components/ToastProvider';

interface UseImageUploadResult {
  uploadImage: (file: File, folder?: string, isTemp?: boolean) => Promise<string | null>;
  uploading: boolean;
}

const MAX_UPLOAD_SIZE = 8 * 1024 * 1024;
const ALLOWED_UPLOAD_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function toSafeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
}

function validateImage(file: File) {
  if (!ALLOWED_UPLOAD_TYPES.has(file.type)) {
    throw new Error('JPG, PNG, WebP, GIF 이미지만 업로드할 수 있습니다.');
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    throw new Error('이미지는 8MB 이하로 업로드해주세요.');
  }
}

export function useImageUpload(): UseImageUploadResult {
  const [uploading, setUploading] = useState(false);
  const activeUploadsRef = useRef(0);
  const { addToast } = useToast();

  const beginUpload = () => {
    activeUploadsRef.current += 1;
    setUploading(true);
  };

  const endUpload = () => {
    activeUploadsRef.current = Math.max(0, activeUploadsRef.current - 1);
    if (activeUploadsRef.current === 0) {
      setUploading(false);
    }
  };

  const uploadImage = async (file: File, folder: string = 'posts', isTemp: boolean = true) => {
    if (!file) return null;

    beginUpload();
    try {
      validateImage(file);
      const timestamp = Date.now();
      const random = Math.random().toString(36).slice(2, 8);
      const fileName = `${timestamp}-${random}-${toSafeFileName(file.name)}`;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', fileName);
      formData.append('folder', folder);
      formData.append('isTemp', isTemp ? 'true' : 'false');

      const response = await uploadImageFile('/api/upload', formData);

      if (!response.ok) {
        throw new Error('업로드 실패');
      }

      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error('이미지 업로드 실패:', error);
      addToast(error instanceof Error ? error.message : '이미지 업로드에 실패했습니다', 'error');
      return null;
    } finally {
      endUpload();
    }
  };

  return { uploadImage, uploading };
}
