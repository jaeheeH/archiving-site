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

    // 1. 모델 정보 조회
    const { data: model } = await supabase.from('trained_models')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!model) {
      return NextResponse.json({ error: '학습된 모델이 없습니다.' }, { status: 400 });
    }

    const { data: brand } = await supabase.from('brands').select('*').eq('id', brandId).single();

    // 2. 상태 업데이트 및 정보 가져오기
    let versionId = model.version_id;
    let replicateTrainingId = model.replicate_training_id;

    console.log('Fetching training info...');
    // any로 캐스팅하여 타입 에러 방지
    const training = await replicate.trainings.get(replicateTrainingId) as any;

    // 상태 동기화
    if (model.status !== 'succeeded') {
      await supabase
        .from('trained_models')
        .update({ 
          status: training.status, 
          version_id: training.output?.version || '' 
        })
        .eq('id', model.id);

      if (training.status !== 'succeeded') {
        if (training.status === 'failed') {
            return NextResponse.json({ error: '학습에 실패했습니다.' }, { status: 400 });
        }
        return NextResponse.json({ 
          status: training.status, 
          message: `아직 AI가 학습 중입니다. (상태: ${training.status})` 
        });
      }
    }

    // 3. 이미지 생성 (Inference)
    // [핵심 수정] destination이 없으면 model 필드를 확인합니다.
    if (!training.output?.version) {
        return NextResponse.json({ error: '모델 버전 정보를 찾을 수 없습니다.' }, { status: 500 });
    }

    let fullModelId = '';
    
    // destination 또는 model 필드 중 하나라도 있으면 사용
    const modelName = training.destination || training.model;

    if (modelName) {
        fullModelId = `${modelName}:${training.output.version}`;
    } else {
         console.error("Training Response Dump:", JSON.stringify(training, null, 2));
         // 만약 둘 다 없으면 로그를 남기고 에러 처리
         throw new Error("Replicate API 응답에서 모델명(destination/model)을 찾을 수 없습니다.");
    }

    console.log('Generating image with:', fullModelId);

    const output = await replicate.run(fullModelId as any, {
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

    // 4. 이미지 영구 저장
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

    // 5. DB 기록
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