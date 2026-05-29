// app/(dashboard)/dashboard/brand-kit/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import imageCompression from 'browser-image-compression';
import { UploadCloud, X } from 'lucide-react';

export default function BrandKitPage() {
  const router = useRouter();
  const [brandName, setBrandName] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  // 이미지 파일 선택 핸들러
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).filter((file) =>
        file.type.startsWith('image/')
      );
      const room = 25 - files.length;

      if (room <= 0) {
        alert('학습 이미지는 최대 25장까지 등록할 수 있습니다.');
        e.target.value = '';
        return;
      }

      const acceptedFiles = newFiles.slice(0, room);

      if (newFiles.length > acceptedFiles.length) {
        alert('최대 25장까지만 추가했습니다.');
      }

      setFiles((prev) => [...prev, ...acceptedFiles]);

      // 미리보기 URL 생성
      const newPreviews = acceptedFiles.map((file) => URL.createObjectURL(file));
      setPreviews((prev) => [...prev, ...newPreviews]);
      e.target.value = '';
    }
  };

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setFiles((prev) => prev.filter((_, idx) => idx !== index));
    setPreviews((prev) => prev.filter((_, idx) => idx !== index));
  };

  // 폼 제출 (브랜드 생성 -> 이미지 업로드 -> 학습 시작)
  const handleSubmit = async () => {
    if (!brandName.trim()) return alert('브랜드 이름을 입력해주세요.');
    if (files.length < 5) return alert('최소 5장 이상의 이미지가 필요합니다. (권장 10~20장)');

    setLoading(true);
    setUploadProgress('브랜드 생성 중...');

    try {
      // 1. 브랜드 생성 (API가 트리거 단어를 자동 생성함)
      const brandRes = await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: brandName }), 
      });

      if (!brandRes.ok) throw new Error('브랜드 생성 실패');
      const newBrand = await brandRes.json();

      // 2. 이미지 업로드 (Supabase Storage)
      setUploadProgress('이미지 업로드 중... (시간이 조금 걸립니다)');
      const uploadedUrls: string[] = [];

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setUploadProgress(`이미지 최적화 및 업로드 중... (${index + 1}/${files.length})`);
        const optimizedFile = await imageCompression(file, {
          maxSizeMB: 1.2,
          maxWidthOrHeight: 1600,
          useWebWorker: true,
          fileType: 'image/jpeg',
          initialQuality: 0.85,
        });

        const formData = new FormData();
        formData.append('brandId', newBrand.id);
        formData.append('file', optimizedFile);

        const uploadRes = await fetch('/api/brands/assets', {
          method: 'POST',
          body: formData,
        });
        const uploadData = await uploadRes.json();

        if (!uploadRes.ok) {
          console.error('Upload error:', uploadData.error);
          continue; // 실패해도 일단 진행
        }
        
        uploadedUrls.push(uploadData.url);
      }

      if (uploadedUrls.length < 5) {
        throw new Error('업로드된 이미지가 5장 미만입니다. 파일을 확인해주세요.');
      }

      // 3. AI 학습 시작 요청
      setUploadProgress('AI 학습 요청 중...');
      
      // 여기서 중요! 
      // API에서 자동 생성된 trigger_word를 그대로 학습 API에 넘겨줘야 합니다.
      const trainRes = await fetch('/api/ai/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: newBrand.id,
          imageUrls: uploadedUrls,
        }),
      });

      if (!trainRes.ok) throw new Error('학습 요청 실패');

      alert('브랜드 등록 완료! 학습이 시작되었습니다.\n(약 20~30분 소요)');
      router.push('/dashboard/brand'); // 관리 페이지로 이동

    } catch (error: any) {
      console.error(error);
      alert(`오류 발생: ${error.message}`);
    } finally {
      setLoading(false);
      setUploadProgress('');
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Brand Kit 등록</h1>
      <p className="text-gray-500 mb-8">우리 브랜드만의 AI 모델을 만들기 위한 학습 데이터를 등록합니다.</p>
      
      <div className="bg-white p-8 rounded-xl shadow-sm border space-y-8">
        
        {/* 1. 브랜드 이름 */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            브랜드 이름
          </label>
          <Input 
            placeholder="예: My Coffee Brand" 
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            className="text-lg p-6"
            disabled={loading}
          />
        </div>


        {/* 3. 이미지 업로드 */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            학습용 이미지 (최소 5장 ~ 최대 25장)
          </label>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors relative">
            <input 
              type="file" 
              multiple 
              accept="image/*"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={loading}
            />
            <div className="pointer-events-none">
              <UploadCloud className="mx-auto mb-3 h-9 w-9 text-gray-400" />
              <p className="text-gray-600 font-medium">클릭하거나 이미지를 여기로 드래그하세요</p>
              <p className="text-xs text-gray-400 mt-2">JPG, PNG 지원 · 업로드 전 1600px/JPEG로 최적화됩니다</p>
            </div>
          </div>

          {/* 미리보기 그리드 */}
          {previews.length > 0 && (
            <div className="mt-4 grid grid-cols-4 md:grid-cols-5 gap-2">
              {previews.map((src, idx) => (
                <div key={src} className="group relative aspect-square bg-gray-100 rounded overflow-hidden border">
                  <img src={src} alt="preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    disabled={loading}
                    className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded bg-white/95 text-gray-700 shadow-sm hover:bg-red-50 hover:text-red-600 disabled:opacity-50 group-hover:flex"
                    title="이미지 제거"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="text-right text-sm text-gray-500 mt-2">
            선택된 이미지: {files.length}장
          </p>
        </div>

        {/* 4. 제출 버튼 */}
        <Button 
          onClick={handleSubmit} 
          disabled={loading || files.length < 5 || !brandName.trim()} 
          className="w-full py-6 text-lg bg-black hover:bg-gray-800 font-bold"
        >
          {loading ? (uploadProgress || '처리 중...') : '브랜드 자산 저장하고 학습 시작'}
        </Button>

      </div>
    </div>
  );
}
