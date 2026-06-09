// app/(dashboard)/dashboard/studio/page.tsx
'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Download, ImageIcon, Sparkles } from 'lucide-react';

type Brand = {
  id: string;
  name: string;
  trained_models?: {
    status: string;
    created_at?: string;
  }[];
};

const ASPECT_RATIOS = ['1:1', '16:9', '9:16', '3:2', '2:3', '4:5'] as const;

type StudioImportPayload = {
  brandId?: string;
  prompt?: string;
  subjectPrompt?: string | null;
  lighting?: string | null;
  camera?: string | null;
  vibe?: string | null;
  background?: string | null;
  promptMode?: string | null;
  aspectRatio?: string;
  seed?: number | string | null;
};

function isSupportedAspectRatio(value: string): value is (typeof ASPECT_RATIOS)[number] {
  return ASPECT_RATIOS.includes(value as (typeof ASPECT_RATIOS)[number]);
}

type ParsedStudioPrompt = {
  subject: string;
  lighting: string;
  camera: string;
  vibe: string;
  background: string;
  hasControls: boolean;
};

const STUDIO_PROMPT_LABEL_PATTERN = /\b(Lighting|Camera|Mood|Background):\s*/gi;
const STUDIO_QUALITY_SUFFIX_PATTERN =
  /(?:,\s*)?(?:high quality|best quality|ultra detailed|8k|4k)\b.*$/i;

function cleanPromptSegment(value: string) {
  return value
    .replace(STUDIO_QUALITY_SUFFIX_PATTERN, '')
    .replace(/^,\s*/, '')
    .replace(/,\s*$/, '')
    .trim();
}

function parseStudioPrompt(value?: string | null): ParsedStudioPrompt {
  const prompt = (value || '').trim();
  const matches = Array.from(prompt.matchAll(STUDIO_PROMPT_LABEL_PATTERN));

  if (!prompt || matches.length === 0) {
    return {
      subject: prompt,
      lighting: '',
      camera: '',
      vibe: '',
      background: '',
      hasControls: false,
    };
  }

  const parsed: ParsedStudioPrompt = {
    subject: prompt.slice(0, matches[0].index).replace(/,\s*$/, '').trim(),
    lighting: '',
    camera: '',
    vibe: '',
    background: '',
    hasControls: true,
  };

  matches.forEach((match, index) => {
    const label = match[1]?.toLowerCase();
    const start = (match.index || 0) + match[0].length;
    const end = matches[index + 1]?.index ?? prompt.length;
    const segment = cleanPromptSegment(prompt.slice(start, end));

    if (!segment) return;
    if (label === 'lighting') parsed.lighting = segment;
    if (label === 'camera') parsed.camera = segment;
    if (label === 'mood') parsed.vibe = segment;
    if (label === 'background') parsed.background = segment;
  });

  return parsed;
}

export default function StudioPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [loadingBrands, setLoadingBrands] = useState(true);
  
  // 프롬프트 옵션들
  const [mainPrompt, setMainPrompt] = useState('');
  const [lighting, setLighting] = useState('Soft natural light');
  const [camera, setCamera] = useState('50mm lens, f/1.8, bokeh');
  const [vibe, setVibe] = useState('Candid, realistic, film grain');
  const [background, setBackground] = useState('Blurred background');
  
  // [NEW] 비율 및 시드 설정
  const [aspectRatio, setAspectRatio] = useState('1:1'); // 기본값 1:1 (정사각형)
  const [seed, setSeed] = useState<string>(''); // 빈값이면 랜덤
  const [usesImportedPrompt, setUsesImportedPrompt] = useState(false);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const isLibraryImport = params.get('from') === 'library';
      let payload: StudioImportPayload | null = null;

      if (isLibraryImport) {
        try {
          const stored = window.sessionStorage.getItem('archb_studio_import');
          payload = stored ? (JSON.parse(stored) as StudioImportPayload) : null;
        } catch {
          payload = null;
        } finally {
          window.sessionStorage.removeItem('archb_studio_import');
        }
      }

      const importedBrandId = payload?.brandId || params.get('brand') || '';
      const importedPrompt = payload?.prompt || params.get('prompt') || '';
      const importedSubjectPrompt = payload?.subjectPrompt || '';
      const importedAspectRatio = payload?.aspectRatio || params.get('aspectRatio') || '';
      const importedSeed = payload?.seed ?? params.get('seed');
      const parsedSubjectPrompt = parseStudioPrompt(importedSubjectPrompt);
      const parsedImportedPrompt = parseStudioPrompt(importedPrompt);
      const hasStoredControls = Boolean(payload?.lighting || payload?.camera || payload?.vibe || payload?.background);
      const canUseStoredSubject =
        Boolean(importedSubjectPrompt) &&
        payload?.promptMode !== 'imported' &&
        !parsedSubjectPrompt.hasControls;
      const recoveredSubject = canUseStoredSubject
        ? importedSubjectPrompt.trim()
        : parsedImportedPrompt.subject;
      const recoveredLighting = payload?.lighting || parsedImportedPrompt.lighting || parsedSubjectPrompt.lighting;
      const recoveredCamera = payload?.camera || parsedImportedPrompt.camera || parsedSubjectPrompt.camera;
      const recoveredVibe = payload?.vibe || parsedImportedPrompt.vibe || parsedSubjectPrompt.vibe;
      const recoveredBackground = payload?.background || parsedImportedPrompt.background || parsedSubjectPrompt.background;

      if (importedBrandId) setSelectedBrand(importedBrandId);
      if (hasStoredControls || recoveredSubject) {
        if (recoveredSubject) {
          setMainPrompt(recoveredSubject);
          setUsesImportedPrompt(false);
        } else if (importedPrompt) {
          setMainPrompt(importedPrompt);
          setUsesImportedPrompt(true);
        }
        if (recoveredLighting) setLighting(recoveredLighting);
        if (recoveredCamera) setCamera(recoveredCamera);
        if (recoveredVibe) setVibe(recoveredVibe);
        if (recoveredBackground) setBackground(recoveredBackground);
      } else if (importedPrompt) {
        setMainPrompt(importedPrompt);
        setUsesImportedPrompt(isLibraryImport || payload?.promptMode === 'imported');
      }
      if (importedAspectRatio && isSupportedAspectRatio(importedAspectRatio)) {
        setAspectRatio(importedAspectRatio);
      }
      if (importedSeed !== null && importedSeed !== undefined && importedSeed !== '') {
        setSeed(String(importedSeed));
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  // 브랜드 목록 불러오기
  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const res = await fetch('/api/brands', { cache: 'no-store' });
        const data = await res.json();

        if (Array.isArray(data)) {
          const requestedBrand =
            typeof window !== 'undefined'
              ? new URLSearchParams(window.location.search).get('brand')
              : null;
          const requestedExists = requestedBrand && data.some((brand: Brand) => brand.id === requestedBrand);

          setBrands(data);
          setSelectedBrand(requestedExists ? requestedBrand : data[0]?.id || '');
        }
      } finally {
        setLoadingBrands(false);
      }
    };
    fetchBrands();
  }, []);

  // 프롬프트 조립
  const finalPrompt = useMemo(
    () => {
      if (usesImportedPrompt) {
        return mainPrompt.trim();
      }

      const parsedMainPrompt = parseStudioPrompt(mainPrompt);
      const subjectPrompt =
        parsedMainPrompt.hasControls && parsedMainPrompt.subject
          ? parsedMainPrompt.subject
          : mainPrompt.trim();

      return [
        subjectPrompt,
        `Lighting: ${lighting}`,
        `Camera: ${camera}`,
        `Mood: ${vibe}`,
        background.trim() ? `Background: ${background.trim()}` : '',
        'high quality',
      ]
        .filter(Boolean)
        .join(', ');
    },
    [background, camera, lighting, mainPrompt, usesImportedPrompt, vibe]
  );

  const activeBrand = brands.find((brand) => brand.id === selectedBrand);
  const activeModelStatus = activeBrand?.trained_models?.[0]?.status || 'pending';
  const canGenerate = Boolean(selectedBrand && mainPrompt.trim() && !isGenerating);
  const handleUseComposedPrompt = () => {
    const parsedMainPrompt = parseStudioPrompt(mainPrompt);

    if (parsedMainPrompt.lighting) setLighting(parsedMainPrompt.lighting);
    if (parsedMainPrompt.camera) setCamera(parsedMainPrompt.camera);
    if (parsedMainPrompt.vibe) setVibe(parsedMainPrompt.vibe);
    if (parsedMainPrompt.background) setBackground(parsedMainPrompt.background);
    if (parsedMainPrompt.hasControls) {
      setMainPrompt(parsedMainPrompt.subject);
    }
    setUsesImportedPrompt(false);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canGenerate) return;

    setIsGenerating(true);
    setStatusMessage('AI 생성 요청 중...');
    setResultImage(null);

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        body: JSON.stringify({ 
          brandId: selectedBrand, 
          prompt: finalPrompt,
          subjectPrompt: usesImportedPrompt ? '' : parseStudioPrompt(mainPrompt).subject || mainPrompt.trim(),
          lighting: usesImportedPrompt ? '' : lighting,
          camera: usesImportedPrompt ? '' : camera,
          vibe: usesImportedPrompt ? '' : vibe,
          background: usesImportedPrompt ? '' : background.trim(),
          promptMode: usesImportedPrompt ? 'imported' : 'composed',
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
        setStatusMessage(`학습이 진행 중입니다. (상태: ${data.status})`);
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
    <div className="mx-auto flex max-w-6xl flex-col gap-8 p-4 sm:p-6 lg:p-8 xl:flex-row xl:gap-10">
      {/* 왼쪽: 컨트롤 패널 */}
      <form onSubmit={handleGenerate} className="w-full space-y-8 xl:w-1/3">
        <div>
          <h1 className="text-2xl font-bold">Studio</h1>
          <p className="mt-2 text-sm text-gray-500">
            학습된 브랜드 모델로 새 이미지를 생성합니다.
          </p>
        </div>
        
        <div className="space-y-5">
          {/* 브랜드 선택 */}
          <div>
            <label className="block text-sm font-bold mb-2">브랜드 선택</label>
            {loadingBrands ? (
              <div className="rounded-lg border bg-white p-3 text-sm text-gray-500">브랜드를 불러오는 중...</div>
            ) : brands.length > 0 ? (
              <>
                <select 
                  className="w-full p-3 border rounded-lg bg-white"
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                >
                  {brands.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-gray-500">모델 상태: {activeModelStatus}</p>
              </>
            ) : (
              <div className="rounded-lg border border-dashed bg-white p-4 text-sm text-gray-600">
                등록된 브랜드가 없습니다.
                <Link href="/dashboard/brand-kit" className="ml-2 font-medium text-blue-600 hover:underline">
                  브랜드 만들기
                </Link>
              </div>
            )}
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
            {usesImportedPrompt && (
              <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                <span>라이브러리 프롬프트 적용 중</span>
                <button
                  type="button"
                  onClick={handleUseComposedPrompt}
                  className="font-semibold hover:underline"
                >
                  옵션 조합 사용
                </button>
              </div>
            )}
          </div>

          {/* 옵션 그리드 */}
          <div className="grid grid-cols-1 gap-4">
            
            {/* [NEW] 화면 비율 (Aspect Ratio) */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">화면 비율 (Ratio)</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ASPECT_RATIOS.map((ratio) => (
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            {finalPrompt || '주제를 입력하면 최종 프롬프트가 표시됩니다.'}
          </div>

          <Button 
            type="submit"
            disabled={!canGenerate}
            className="w-full py-6 text-lg bg-indigo-600 hover:bg-indigo-700 font-bold shadow-md"
          >
            {isGenerating ? statusMessage : '이미지 생성하기'}
          </Button>

          {statusMessage && (
            <div className={`p-3 rounded text-sm text-center ${statusMessage.includes('완료') ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
              {statusMessage}
            </div>
          )}
        </div>
      </form>

      {/* 오른쪽: 결과 뷰어 */}
      <div className="relative flex min-h-[360px] w-full items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-100 sm:min-h-[460px] xl:min-h-[560px] xl:w-2/3">
        {resultImage ? (
          <div className="relative w-full h-full flex items-center justify-center p-4">
             {/* 이미지 비율에 따라 뷰어 스타일이 유동적이어야 함 */}
             <img src={resultImage} alt="Generated" className="max-w-full max-h-[700px] object-contain rounded-lg shadow-2xl" />
             <a 
                href={resultImage} 
                download 
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-6 right-6 inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium shadow hover:bg-gray-50"
              >
                <Download className="h-4 w-4" />
                원본 다운로드
              </a>
          </div>
        ) : (
          <div className="text-gray-400 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-md bg-white text-gray-500 shadow-sm">
              {isGenerating ? <Sparkles className="h-7 w-7" /> : <ImageIcon className="h-7 w-7" />}
            </div>
            <p className="text-lg font-medium sm:text-xl">왼쪽에서 설정을 마치고 생성해주세요</p>
            <p className="text-sm mt-2">비율과 시드값을 조절하여 원하는 결과를 얻으세요</p>
          </div>
        )}
      </div>
    </div>
  );
}
