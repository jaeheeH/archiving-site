// app/api/ai/generate/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
  try {
    const { brandId, prompt, aspectRatio, seed } = await request.json();
    const supabase = await createClient();

    // [NEW] 0. 현재 로그인한 사용자 확인
    // 서버에서 안전하게 유저 정보를 가져옵니다.
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

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

    // 2. 학습 정보 확인 (Lazy Check)
    let replicateTrainingId = model.replicate_training_id;
    console.log('Fetching training info...');
    
    const training = await replicate.trainings.get(replicateTrainingId) as any;

    if (model.status !== 'succeeded') {
      await supabase.from('trained_models')
        .update({ status: training.status, version_id: training.output?.version || '' })
        .eq('id', model.id);

      if (training.status !== 'succeeded') {
        if (training.status === 'failed') return NextResponse.json({ error: '학습 실패' }, { status: 400 });
        return NextResponse.json({ status: training.status, message: '학습 진행 중' });
      }
    }

    // 3. 이미지 생성 (Inference)
    if (!training.output?.version) {
        return NextResponse.json({ error: '버전 정보 없음' }, { status: 500 });
    }

    let fullModelId = '';
    const modelName = training.destination || training.model;

    if (modelName) {
        fullModelId = `${modelName}:${training.output.version}`;
    } else {
         throw new Error("모델명을 찾을 수 없습니다.");
    }

    // 시드 결정 (사용자 입력 or 랜덤)
    const finalSeed = (seed && seed !== '') 
      ? Number(seed) 
      : Math.floor(Math.random() * 4294967295);

    console.log(`Generating with Seed: ${finalSeed} (User input: ${seed ? 'Yes' : 'No'})`);

    const inputParams: any = {
      prompt: `${prompt}, ${brand.trigger_word}`,
      lora_scale: 0.9,
      num_inference_steps: 28,
      disable_safety_checker: true,
      output_format: "jpg",
      aspect_ratio: aspectRatio || "1:1",
      seed: finalSeed
    };

    const output = await replicate.run(fullModelId as any, {
      input: inputParams
    }) as string[];

    const replicateImageUrl = output[0];

    // 4. 저장 로직
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

    // 5. DB에 기록 (작성자 ID 포함!)
    await supabase.from('generated_images').insert({
      brand_id: brandId,
      image_url: publicUrl,
      prompt: prompt,
      aspect_ratio: aspectRatio || '1:1',
      seed: finalSeed,
      user_id: user.id // [핵심] 여기에 작성자 ID가 들어갑니다.
    });

    return NextResponse.json({ 
      success: true, 
      imageUrl: publicUrl, 
      status: 'succeeded',
      seed: finalSeed 
    });

  } catch (error: any) {
    console.error('Gen Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}