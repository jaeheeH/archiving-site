// app/(dashboard)/dashboard/studio/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

export default function StudioPage() {
  const [brands, setBrands] = useState<any[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  
  // 프롬프트 옵션들
  const [mainPrompt, setMainPrompt] = useState('');
  const [lighting, setLighting] = useState('Soft natural light');
  const [camera, setCamera] = useState('50mm lens, f/1.8, bokeh');
  const [vibe, setVibe] = useState('Candid, realistic, film grain');
  const [background, setBackground] = useState('Blurred background');
  
  // [NEW] 비율 및 시드 설정
  const [aspectRatio, setAspectRatio] = useState('1:1'); // 기본값 1:1 (정사각형)
  const [seed, setSeed] = useState<string>(''); // 빈값이면 랜덤
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  // 브랜드 목록 불러오기
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

  // 프롬프트 조립
  const constructFinalPrompt = () => {
    return `${mainPrompt}, Lighting: ${lighting}, Camera: ${camera}, Mood: ${vibe}, Background: ${background}, high quality, 8k`;
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setStatusMessage('AI 생성 요청 중...');
    setResultImage(null);

    const finalPrompt = constructFinalPrompt();

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        body: JSON.stringify({ 
          brandId: selectedBrand, 
          prompt: finalPrompt,
          // [NEW] 비율과 시드값 전송
          aspectRatio,
          seed: seed ? Number(seed) : undefined
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await res.json();

      if (data.status === 'succeeded') {
        setResultImage(data.imageUrl);
        setStatusMessage('생성 완료!');
      } else if (data.status === 'processing' || data.status === 'starting') {
        setStatusMessage(`⚠️ 학습이 진행 중입니다. (상태: ${data.status})`);
      } else {
        setStatusMessage('오류 발생: ' + (data.error || data.message));
      }
    } catch (error) {
      console.error(error);
      setStatusMessage('오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto flex gap-10">
      {/* 왼쪽: 컨트롤 패널 */}
      <div className="w-1/3 space-y-8">
        <h1 className="text-2xl font-bold">Studio</h1>
        
        <div className="space-y-5">
          {/* 브랜드 선택 */}
          <div>
            <label className="block text-sm font-bold mb-2">브랜드 선택</label>
            <select 
              className="w-full p-3 border rounded-lg bg-white"
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
            >
              {brands.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* 메인 프롬프트 */}
          <div>
            <label className="block text-sm font-bold mb-2">무엇을 그릴까요? (주제)</label>
            <textarea 
              className="w-full p-3 border rounded-lg h-24 resize-none focus:ring-2 focus:ring-indigo-500"
              placeholder="예: A woman holding a coffee cup, smiling"
              value={mainPrompt}
              onChange={(e) => setMainPrompt(e.target.value)}
            />
          </div>

          {/* 옵션 그리드 */}
          <div className="grid grid-cols-1 gap-4">
            
            {/* [NEW] 화면 비율 (Aspect Ratio) */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">화면 비율 (Ratio)</label>
              <div className="grid grid-cols-3 gap-2">
                {['1:1', '16:9', '9:16', '3:2', '2:3', '4:5'].map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => setAspectRatio(ratio)}
                    className={`p-2 text-xs rounded border ${
                      aspectRatio === ratio 
                        ? 'bg-indigo-600 text-white border-indigo-600' 
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
               {/* 조명 */}
               <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">조명</label>
                <select className="w-full p-2 border rounded text-sm" value={lighting} onChange={(e) => setLighting(e.target.value)}>
                  <option value="Soft natural light">자연광</option>
                  <option value="Golden hour sunlight">골든아워</option>
                  <option value="Cinematic lighting">영화조명</option>
                  <option value="Neon lights">네온</option>
                  <option value="Studio lighting">스튜디오</option>
                </select>
              </div>

               {/* 카메라 */}
               <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">카메라</label>
                <select className="w-full p-2 border rounded text-sm" value={camera} onChange={(e) => setCamera(e.target.value)}>
                  <option value="50mm lens, f/1.8">표준(50mm)</option>
                  <option value="35mm lens">광각(35mm)</option>
                  <option value="Kodak Portra 400">필름감성</option>
                  <option value="Macro lens">접사</option>
                </select>
              </div>
            </div>

            {/* 분위기 */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">분위기</label>
              <select className="w-full p-2 border rounded text-sm" value={vibe} onChange={(e) => setVibe(e.target.value)}>
                <option value="Candid, realistic">자연스러운</option>
                <option value="Elegant, luxurious">고급스러운</option>
                <option value="Vintage, retro">빈티지</option>
                <option value="Minimalist, clean">미니멀</option>
              </select>
            </div>

             {/* 배경 */}
             <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">배경</label>
              <input type="text" className="w-full p-2 border rounded text-sm" placeholder="예: Seoul street..." value={background} onChange={(e) => setBackground(e.target.value)} />
            </div>

            {/* [NEW] 시드 (고급 설정) */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">시드 (Seed - 고정용)</label>
              <input 
                type="number" 
                className="w-full p-2 border rounded text-sm" 
                placeholder="랜덤 (비워두면 자동)" 
                value={seed} 
                onChange={(e) => setSeed(e.target.value)} 
              />
              <p className="text-[10px] text-gray-400 mt-1">
                * 마음에 드는 결과가 나오면, 그 이미지의 시드값을 여기에 넣어 똑같은 구도로 다시 뽑을 수 있습니다.
              </p>
            </div>

          </div>

          <div className="bg-gray-50 p-3 rounded text-xs text-gray-500 break-words">
            <strong>Prompt Preview:</strong><br/>
            {constructFinalPrompt()}
          </div>

          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating || !selectedBrand || !mainPrompt}
            className="w-full py-6 text-lg bg-indigo-600 hover:bg-indigo-700 font-bold shadow-md"
          >
            {isGenerating ? statusMessage : '✨ 이미지 생성하기'}
          </Button>

          {statusMessage && (
            <div className={`p-3 rounded text-sm text-center ${statusMessage.includes('완료') ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
              {statusMessage}
            </div>
          )}
        </div>
      </div>

      {/* 오른쪽: 결과 뷰어 */}
      <div className="w-2/3 bg-gray-100 rounded-xl flex items-center justify-center min-h-[600px] border-2 border-dashed border-gray-300 relative">
        {resultImage ? (
          <div className="relative w-full h-full flex items-center justify-center p-4">
             {/* 이미지 비율에 따라 뷰어 스타일이 유동적이어야 함 */}
             <img src={resultImage} alt="Generated" className="max-w-full max-h-[700px] object-contain rounded-lg shadow-2xl" />
             <a 
                href={resultImage} 
                download 
                target="_blank"
                className="absolute bottom-6 right-6 bg-white px-4 py-2 rounded-full shadow hover:bg-gray-50 font-medium text-sm"
              >
                💾 원본 다운로드
              </a>
          </div>
        ) : (
          <div className="text-gray-400 text-center">
            <div className="text-6xl mb-4">🎨</div>
            <p className="text-xl font-medium">왼쪽에서 설정을 마치고 생성해주세요</p>
            <p className="text-sm mt-2">비율과 시드값을 조절하여 원하는 결과를 얻으세요</p>
          </div>
        )}
      </div>
    </div>
  );
}