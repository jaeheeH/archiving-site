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

    // 2. 상태 업데이트 체크
    let versionId = model.version_id;
    let replicateTrainingId = model.replicate_training_id;

    // TypeScript 에러 방지를 위해 any 캐스팅
    console.log('Fetching training info...');
    const training = await replicate.trainings.get(replicateTrainingId) as any;

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
      
      if (!training.output?.version) {
         return NextResponse.json({ error: '학습 완료 후 버전 정보를 찾을 수 없습니다.' }, { status: 500 });
      }
      versionId = training.output.version;
    }

    // 3. 이미지 생성 (Inference)
    console.log('Generating image with version:', versionId);
    
    if (!training.output?.version) {
        return NextResponse.json({ error: '모델 버전 정보를 찾을 수 없습니다.' }, { status: 500 });
    }

    let fullModelId = '';
    if (training.destination) {
        fullModelId = `${training.destination}:${training.output.version}`;
    } else {
         throw new Error("Replicate API 응답에 destination 정보가 없습니다.");
    }

    // [수정된 부분] 여기서 fullModelId 뒤에 'as any'를 붙여서 타입 검사를 통과시킵니다.
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