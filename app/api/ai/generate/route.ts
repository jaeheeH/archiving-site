// app/api/ai/generate/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
  try {
    const { brandId, prompt } = await request.json();
    const supabase = await createClient();

    // 1. 모델 정보 조회 (상태 상관없이 일단 가져옴)
    const { data: model } = await supabase.from('trained_models')
      .select('*')
      .eq('brand_id', brandId)
      // .eq('status', 'succeeded') <--- 이 줄을 삭제했습니다.
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!model) {
      return NextResponse.json({ error: '학습된 모델이 없습니다.' }, { status: 400 });
    }

    const { data: brand } = await supabase.from('brands').select('*').eq('id', brandId).single();

    // 2. [복구된 로직] 상태 업데이트 체크
    // DB가 아직 'succeeded'가 아니라면 Replicate에 확인해본다.
    let versionId = model.version_id;
    let replicateTrainingId = model.replicate_training_id;

    if (model.status !== 'succeeded') {
      console.log('Checking Replicate status...');
      const training = await replicate.trainings.get(replicateTrainingId);
      
      // DB 상태 업데이트
      await supabase
        .from('trained_models')
        .update({ 
          status: training.status, 
          version_id: training.output?.version || '' 
        })
        .eq('id', model.id);

      // 아직도 안 끝났으면 리턴
      if (training.status !== 'succeeded') {
        if (training.status === 'failed') {
            return NextResponse.json({ error: '학습에 실패했습니다. Replicate 로그를 확인하세요.' }, { status: 400 });
        }
        return NextResponse.json({ 
          status: training.status, 
          message: `아직 AI가 학습 중입니다. (상태: ${training.status})` 
        });
      }
      
      // 방금 끝났으면 버전 ID 획득
      versionId = training.output.version;
    }

    // 3. 이미지 생성 (Inference)
    console.log('Generating image with version:', versionId);
    
    // 모델 전체 ID 구성 (destination + version hash)
    const trainingInfo = await replicate.trainings.get(replicateTrainingId);
    const fullModelId = `${trainingInfo.destination}:${trainingInfo.output.version}`;

    const output = await replicate.run(fullModelId, {
      input: {
        prompt: `${prompt}, ${brand.trigger_word}`,
        lora_scale: 0.9,
        num_inference_steps: 28,
        output_format: "jpg",
        aspect_ratio: "1:1",
        disable_safety_checker: true
      }
    }) as string[];

    const replicateImageUrl = output[0];

    // 4. 이미지 영구 저장 (Supabase Storage)
    const imageRes = await fetch(replicateImageUrl);
    const imageBlob = await imageRes.blob();
    const fileName = `${brandId}/${Date.now()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('generated-images')
      .upload(fileName, imageBlob, { contentType: 'image/jpeg' });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('generated-images')
      .getPublicUrl(fileName);

    // 5. DB에 생성 기록 저장
    await supabase.from('generated_images').insert({
      brand_id: brandId,
      image_url: publicUrl,
      prompt: prompt
    });

    return NextResponse.json({ success: true, imageUrl: publicUrl, status: 'succeeded' });

  } catch (error: any) {
    console.error('Gen Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}