// app/(dashboard)/dashboard/brand-kit/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles]);

      // 미리보기 URL 생성
      const newPreviews = newFiles.map((file) => URL.createObjectURL(file));
      setPreviews((prev) => [...prev, ...newPreviews]);
    }
  };

  // 폼 제출 (브랜드 생성 -> 이미지 업로드 -> 학습 시작)
  const handleSubmit = async () => {
    if (!brandName.trim()) return alert('브랜드 이름을 입력해주세요.');
    if (files.length < 5) return alert('최소 5장 이상의 이미지가 필요합니다. (권장 10~20장)');

    setLoading(true);
    setUploadProgress('브랜드 생성 중...');

    try {
      const supabase = createClient();

      // 1. 브랜드 생성 (API가 트리거 단어를 자동 생성함)
      const brandRes = await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: brandName }), 
      });

      if (!brandRes.ok) throw new Error('브랜드 생성 실패');
      const newBrand = await brandRes.json();
      
      console.log('Created Brand:', newBrand); // 디버깅용

      // 2. 이미지 업로드 (Supabase Storage)
      setUploadProgress('이미지 업로드 중... (시간이 조금 걸립니다)');
      const uploadedUrls: string[] = [];

      for (const file of files) {
        // 파일명: brand_id/timestamp_random.jpg
        const fileExt = file.name.split('.').pop();
        const fileName = `${newBrand.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('brand-assets')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue; // 실패해도 일단 진행
        }

        // 공개 URL 가져오기
        const { data: { publicUrl } } = supabase.storage
          .from('brand-assets')
          .getPublicUrl(fileName);
        
        uploadedUrls.push(publicUrl);
      }

      if (uploadedUrls.length === 0) throw new Error('이미지 업로드에 실패했습니다.');

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
          instance_prompt: newBrand.trigger_word // 자동 생성된 트리거 단어 사용
        }),
      });

      if (!trainRes.ok) throw new Error('학습 요청 실패');

      alert('브랜드 등록 완료! 학습이 시작되었습니다.\n(약 20~30분 소요)');
      router.push('/dashboard/brands'); // 관리 페이지로 이동

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
            학습용 이미지 (최소 5장 ~ 권장 20장)
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
              <p className="text-4xl mb-2">📸</p>
              <p className="text-gray-600 font-medium">클릭하거나 이미지를 여기로 드래그하세요</p>
              <p className="text-xs text-gray-400 mt-2">JPG, PNG 지원</p>
            </div>
          </div>

          {/* 미리보기 그리드 */}
          {previews.length > 0 && (
            <div className="mt-4 grid grid-cols-4 md:grid-cols-5 gap-2">
              {previews.map((src, idx) => (
                <div key={idx} className="aspect-square bg-gray-100 rounded overflow-hidden border">
                  <img src={src} alt="preview" className="w-full h-full object-cover" />
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
          {loading ? (uploadProgress || '처리 중...') : '🚀 브랜드 자산 저장하고 학습 시작'}
        </Button>

      </div>
    </div>
  );
}