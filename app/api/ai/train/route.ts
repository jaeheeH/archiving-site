import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Replicate from 'replicate';
import JSZip from 'jszip';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

async function downloadImage(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download image: ${url}`);
  return response.arrayBuffer();
}

export async function POST(request: Request) {
  try {
    const { brandId, imageUrls, instance_prompt } = await request.json();
    const supabase = await createClient();

    // 1. 필수 값 검증
    if (!brandId || !imageUrls || imageUrls.length === 0) {
      return NextResponse.json({ error: '필수 정보가 누락되었습니다.' }, { status: 400 });
    }

    // 2. 브랜드 정보 가져오기
    const { data: brand } = await supabase
      .from('brands')
      .select('name, trigger_word')
      .eq('id', brandId)
      .single();

    if (!brand) return NextResponse.json({ error: '브랜드를 찾을 수 없습니다.' }, { status: 404 });

    // 3. Zip 압축
    console.log(`Starting to zip ${imageUrls.length} images...`);
    const zip = new JSZip();

    await Promise.all(
      imageUrls.map(async (url: string, index: number) => {
        try {
          const arrayBuffer = await downloadImage(url);
          const ext = url.split('.').pop()?.split('?')[0] || 'jpg';
          zip.file(`${index}.${ext}`, arrayBuffer);
        } catch (e) {
          console.error(`Error downloading image ${url}:`, e);
        }
      })
    );

    const zipContent = await zip.generateAsync({ type: 'blob' });
    const zipArrayBuffer = await zipContent.arrayBuffer();
    
    // 4. Supabase에 Zip 업로드
    const zipFileName = `${brandId}/training_set_${Date.now()}.zip`;
    const { error: uploadError } = await supabase.storage
      .from('brand-assets')
      .upload(zipFileName, zipArrayBuffer, {
        contentType: 'application/zip',
        upsert: true
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl: zipUrl } } = supabase.storage
      .from('brand-assets')
      .getPublicUrl(zipFileName);

    console.log('Zip file uploaded to:', zipUrl);

    // 5. Replicate 학습 요청 준비
    const owner = process.env.REPLICATE_USER_ID;
    if (!owner) throw new Error("REPLICATE_USER_ID 환경변수가 설정되지 않았습니다.");

    const safeName = brand.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const modelName = `${safeName}-${Math.floor(Date.now() / 1000)}`; 
    const destination = `${owner}/${modelName}`;

    console.log(`Creating model container: ${destination}`);

    try {
      await replicate.models.create(owner, modelName, {
        visibility: "private",
        hardware: "gpu-t4",
      });
    } catch (e: any) {
      console.log("Model creation info:", e.message);
    }

    // [핵심 수정] 학습용 모델의 최신 버전을 동적으로 가져옵니다.
    // 이렇게 하면 구버전 ID 문제(404 에러)가 완벽하게 해결됩니다.
    console.log("Fetching latest trainer version...");
    const trainerModel = await replicate.models.get("ostris", "flux-dev-lora-trainer");
    const latestVersion = trainerModel.latest_version?.id;

    if (!latestVersion) {
        throw new Error("Trainer model version not found");
    }

    console.log(`Starting training using version: ${latestVersion}`);

    // 학습 시작 요청
    const training = await replicate.trainings.create(
      "ostris",
      "flux-dev-lora-trainer",
      latestVersion, // [수정됨] 동적으로 가져온 최신 ID 사용
      {
        destination: destination,
        input: {
          input_images: zipUrl,
          trigger_word: instance_prompt || brand.trigger_word,
          steps: 1000,
          lora_rank: 16,
          optimizer: "adamw8bit",
          learning_rate: 0.0004
        }
      }
    );

    console.log('Training started:', training.id);

    // 6. DB 저장
    await supabase.from('trained_models').insert({
      brand_id: brandId,
      replicate_training_id: training.id,
      status: 'starting',
      version_id: '' 
    });

    return NextResponse.json({ success: true, trainingId: training.id });

  } catch (error: any) {
    console.error('Training Error:', error);
    return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
  }
}