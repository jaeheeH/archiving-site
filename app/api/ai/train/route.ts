// app/api/ai/train/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Replicate from 'replicate';
import JSZip from 'jszip';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
  try {
    const { brandId } = await request.json();
    const supabase = await createClient();

    // 1. 브랜드 정보 및 자산 가져오기
    const { data: brand } = await supabase
      .from('brands')
      .select('*')
      .eq('id', brandId)
      .single();

    const { data: assets } = await supabase
      .from('brand_assets')
      .select('*')
      .eq('brand_id', brandId);

    if (!assets || assets.length === 0) {
      return NextResponse.json({ error: 'No assets found' }, { status: 400 });
    }

    // 2. 이미지들을 다운로드하여 Zip으로 압축
    const zip = new JSZip();
    
    await Promise.all(assets.map(async (asset) => {
      const { data, error } = await supabase
        .storage
        .from('brand-assets')
        .download(asset.storage_path);
      
      if (error) {
        console.error(`Download failed for ${asset.file_name}:`, error);
        return;
      }

      if (data) {
        const arrayBuffer = await data.arrayBuffer();
        zip.file(asset.file_name || asset.storage_path.split('/').pop(), arrayBuffer);
      }
    }));

    const zipContent = await zip.generateAsync({ type: 'nodebuffer' });

    // 3. Zip 파일 업로드
    const zipPath = `${brandId}/training_data_${Date.now()}.zip`;
    const { error: uploadError } = await supabase
      .storage
      .from('brand-assets')
      .upload(zipPath, zipContent, {
        contentType: 'application/zip',
        upsert: true
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase
      .storage
      .from('brand-assets')
      .getPublicUrl(zipPath);

    // ---------------------------------------------------------
    // 4. 모델 생성 및 학습 요청 (수정된 부분)
    // ---------------------------------------------------------
    
    const owner = process.env.REPLICATE_USER_ID;
    if (!owner) {
      throw new Error("REPLICATE_USER_ID is missing in .env file");
    }

    // [수정] 모델 이름 규칙 강화 (영문 소문자, 숫자, 하이픈만 허용)
    const sanitizedBrandName = brand.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const modelName = `${sanitizedBrandName}-${Math.floor(Date.now() / 1000)}`; 

    console.log(`Creating model: ${owner}/${modelName}`);

    // [신규] 학습 결과물을 담을 모델을 먼저 생성해야 합니다.
    try {
      await replicate.models.create(owner, modelName, {
        visibility: "private",
        hardware: "gpu-t4", // 모델 설정을 위한 기본값 (실제 학습/생성 GPU와는 무관)
      });
    } catch (e: any) {
      // 이미 존재한다는 에러는 무시해도 되지만, 다른 에러는 로그 출력
      console.log("Model creation info:", e.message);
    }

    console.log(`Starting training... Destination: ${owner}/${modelName}`);

    const training = await replicate.trainings.create(
      "ostris",
      "flux-dev-lora-trainer",
      "e440909d3512c31646ee2e0c7d6f6f4923224863a6a10c494606e79fb5844497",
      {
        destination: `${owner}/${modelName}`,
        input: {
          input_images: publicUrl,
          trigger_word: brand.trigger_word,
          steps: 1000,
          lora_rank: 16,
          optimizer: "adamw8bit",
          learning_rate: 0.0004
        }
      }
    );

    // 5. DB 기록
    await supabase.from('trained_models').insert({
      brand_id: brandId,
      replicate_training_id: training.id,
      version_id: '', // 학습 완료 후 업데이트됨
      status: 'processing'
    });

    return NextResponse.json({ success: true, trainingId: training.id });

  } catch (error: any) {
    console.error('Training Error:', error);
    return NextResponse.json({ error: error.message || 'Training failed' }, { status: 500 });
  }
}