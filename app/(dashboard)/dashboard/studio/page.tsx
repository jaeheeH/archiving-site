// app/(dashboard)/dashboard/studio/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';

export default function StudioPage() {
  const [brands, setBrands] = useState<any[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  // 1. 내 브랜드 목록 불러오기
  useEffect(() => {
    const fetchBrands = async () => {
      const supabase = createClient();
      const { data } = await supabase.from('brands').select('id, name');
      if (data) {
        setBrands(data);
        if (data.length > 0) setSelectedBrand(data[0].id);
      }
    };
    fetchBrands();
  }, []);

  // 2. 이미지 생성 요청
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setStatusMessage('AI와 통신 중...');
    setResultImage(null);

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        body: JSON.stringify({ brandId: selectedBrand, prompt }),
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await res.json();

      if (data.status === 'succeeded') {
        setResultImage(data.imageUrl);
        setStatusMessage('생성 완료!');
      } else if (data.status === 'processing' || data.status === 'starting') {
        setStatusMessage(`⚠️ 아직 학습이 진행 중입니다. (상태: ${data.status}) 잠시 후 다시 시도해주세요.`);
      } else {
        setStatusMessage('오류 발생: ' + (data.error || data.message));
      }
    } catch (error) {
      setStatusMessage('네트워크 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto flex gap-8">
      {/* 왼쪽: 컨트롤 패널 */}
      <div className="w-1/3 space-y-6">
        <h1 className="text-2xl font-bold">Studio</h1>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">브랜드 선택</label>
            <select 
              className="w-full p-2 border rounded-md"
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
            >
              {brands.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">프롬프트 (명령어)</label>
            <textarea 
              className="w-full p-3 border rounded-md h-32 resize-none"
              placeholder="예: on a wooden table, soft lighting, 4k"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating || !selectedBrand}
            className="w-full py-6 text-lg bg-indigo-600 hover:bg-indigo-700"
          >
            {isGenerating ? '생성 중...' : '이미지 생성하기'}
          </Button>

          {statusMessage && (
            <div className={`p-3 rounded text-sm ${statusMessage.includes('완료') ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
              {statusMessage}
            </div>
          )}
        </div>
      </div>

      {/* 오른쪽: 결과 뷰어 */}
      <div className="w-2/3 bg-gray-100 rounded-xl flex items-center justify-center min-h-[500px] border-2 border-dashed border-gray-300">
        {resultImage ? (
          <img src={resultImage} alt="Generated" className="max-w-full max-h-[600px] rounded shadow-lg" />
        ) : (
          <div className="text-gray-400 text-center">
            <p className="text-xl font-medium">결과 이미지가 여기에 표시됩니다</p>
            <p className="text-sm mt-2">왼쪽에서 브랜드와 프롬프트를 입력하세요</p>
          </div>
        )}
      </div>
    </div>
  );
}