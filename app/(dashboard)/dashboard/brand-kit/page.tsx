// app/(dashboard)/dashboard/brand-kit/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button'; 
import { Input } from '@/components/ui/input';

export default function BrandKitPage() {
  const router = useRouter();
  
  // 상태 변수들은 반드시 컴포넌트 함수 내부에 있어야 합니다.
  const [brandId, setBrandId] = useState<string | null>(null);
  const [isTraining, setIsTraining] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    triggerWord: 'OHJI_STYLE', 
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setImages(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (images.length < 5) {
      alert('최소 5장 이상의 이미지를 업로드해주세요.');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const submitData = new FormData();
      submitData.append('name', formData.name);
      submitData.append('triggerWord', formData.triggerWord);
      images.forEach((file) => {
        submitData.append('files', file);
      });

      const res = await fetch('/api/brands', {
        method: 'POST',
        body: submitData,
      });

      if (!res.ok) throw new Error('Failed to create brand');

      const data = await res.json(); 
      setBrandId(data.brandId); // 성공 시 브랜드 ID 저장하여 학습 버튼 노출

      alert('브랜드가 성공적으로 등록되었습니다! 이제 학습을 시작할 수 있습니다.');
      // router.refresh(); // 학습 버튼을 보여주기 위해 새로고침 잠시 보류
    } catch (error) {
      console.error(error);
      alert('등록 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Brand Kit 등록</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-sm border">
        
        {/* 브랜드 이름 */}
        <div className="space-y-2">
          <label className="text-sm font-medium">브랜드 이름</label>
          <Input 
            required
            placeholder="예: My Coffee Brand"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
          />
        </div>

        {/* 트리거 단어 */}
        <div className="space-y-2">
          <label className="text-sm font-medium">트리거 단어 (AI 호출용 암호)</label>
          <Input 
            required
            placeholder="예: OHJI_STYLE"
            value={formData.triggerWord}
            onChange={(e) => setFormData({...formData, triggerWord: e.target.value})}
          />
          <p className="text-xs text-gray-500">AI에게 "이 스타일로 그려줘"라고 명령할 때 사용할 단어입니다.</p>
        </div>

        {/* 이미지 업로드 */}
        <div className="space-y-2">
          <label className="text-sm font-medium">학습용 이미지 (최소 5장 ~ 권장 20장)</label>
          <div className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-gray-50 transition-colors">
            <input 
              type="file" 
              multiple 
              accept="image/*" 
              onChange={handleImageChange}
              className="hidden" 
              id="image-upload"
            />
            <label htmlFor="image-upload" className="cursor-pointer block">
              <span className="text-blue-600 font-medium">파일 선택</span> 또는 여기로 드래그
              <p className="text-sm text-gray-500 mt-2">
                {images.length > 0 ? `${images.length}개의 파일 선택됨` : '로고, 제품, 분위기 사진을 업로드하세요'}
              </p>
            </label>
          </div>
        </div>

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? '업로드 및 저장 중...' : '브랜드 자산 저장하기'}
        </Button>
      </form>

      {/* 학습 시작 섹션: 등록 성공 시 나타남 */}
      {brandId && (
        <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg text-center">
          <h3 className="text-lg font-bold text-blue-900 mb-2">🚀 AI 학습 준비 완료</h3>
          <p className="text-blue-700 mb-4">
            이미지들이 안전하게 저장되었습니다.<br/>
            이제 AI에게 이 브랜드의 스타일을 학습시키시겠습니까? (약 20분 소요)
          </p>
          <Button 
            onClick={async () => {
              setIsTraining(true);
              try {
                const res = await fetch('/api/ai/train', {
                  method: 'POST',
                  body: JSON.stringify({ brandId }),
                  headers: { 'Content-Type': 'application/json' }
                });
                
                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.error || 'Training request failed');
                }
                
                const result = await res.json();
                console.log('Training started:', result);
                
                alert('학습이 시작되었습니다! (Training ID: ' + result.trainingId + ')');
              } catch (e: any) {
                alert('학습 요청 실패: ' + e.message);
              } finally {
                setIsTraining(false);
              }
            }}
            disabled={isTraining}
            className="bg-blue-600 hover:bg-blue-700 w-full py-6 text-lg"
          >
            {isTraining ? 'AI가 요리 재료를 손질 중입니다... (Zip 압축 중)' : 'Start Training (약 2,000원 소요)'}
          </Button>
        </div>
      )}
    </div>
  );
}