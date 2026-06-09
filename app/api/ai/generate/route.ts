// app/api/ai/generate/route.ts
import { NextResponse } from 'next/server';
import Replicate from 'replicate';
import { getBrandManagerContext } from '@/lib/brand-manager-auth';
import { getErrorMessage } from '@/lib/error-message';
import { isSafeIdentifierParam } from '@/lib/route-params';

type ReplicateTraining = {
  status?: string;
  destination?: string;
  model?: string;
  output?: {
    version?: string;
  } | null;
};

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const DEBUG_API_LOGS = process.env.DEBUG_API_LOGS === 'true';
const MAX_PROMPT_LENGTH = 1500;
const MAX_PROMPT_OPTION_LENGTH = 300;
const MAX_GENERATED_IMAGE_BYTES = 12 * 1024 * 1024;
const ALLOWED_ASPECT_RATIOS = new Set([
  '1:1',
  '16:9',
  '9:16',
  '4:3',
  '3:4',
  '3:2',
  '2:3',
  '4:5',
  '5:4',
]);

function debugLog(...args: unknown[]) {
  if (DEBUG_API_LOGS) console.info(...args);
}

function normalizePrompt(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, MAX_PROMPT_LENGTH);
}

function normalizePromptOption(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, MAX_PROMPT_OPTION_LENGTH);
}

function normalizePromptMode(value: unknown) {
  return value === 'imported' ? 'imported' : 'composed';
}

function isMissingGenerationMetadataColumn(error: unknown) {
  const queryError = error as { code?: string; message?: string } | null;
  const message = queryError?.message || '';
  const hasMetadataColumnName = /(subject_prompt|lighting|camera|vibe|background|prompt_mode)/i.test(message);

  return (
    hasMetadataColumnName &&
    (queryError?.code === '42703' || queryError?.code === 'PGRST204')
  );
}

function normalizeAspectRatio(value: unknown) {
  return typeof value === 'string' && ALLOWED_ASPECT_RATIOS.has(value) ? value : '1:1';
}

function normalizeSeed(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return Math.floor(Math.random() * 4294967295);
  }

  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 4294967295) {
    return null;
  }

  return numeric;
}

function normalizeOutputUrl(value: unknown): string {
  if (typeof value === 'string') {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : '';
    } catch {
      return '';
    }
  }

  if (value instanceof URL) {
    return value.protocol === 'http:' || value.protocol === 'https:' ? value.toString() : '';
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const url = normalizeOutputUrl(item);
      if (url) return url;
    }

    return '';
  }

  if (!value || typeof value !== 'object') return '';

  const output = value as {
    url?: unknown;
    toString?: unknown;
    output?: unknown;
    image?: unknown;
    images?: unknown;
  };

  if (typeof output.url === 'function') {
    try {
      const url = normalizeOutputUrl(output.url.call(value));
      if (url) return url;
    } catch {
      // Some SDK output objects expose url(), but it can throw for non-URL streams.
    }
  }

  if (output.output) {
    const url = normalizeOutputUrl(output.output);
    if (url) return url;
  }

  if (output.image) {
    const url = normalizeOutputUrl(output.image);
    if (url) return url;
  }

  if (output.images) {
    const url = normalizeOutputUrl(output.images);
    if (url) return url;
  }

  try {
    if (typeof output.toString === 'function') {
      const text = output.toString.call(value);
      if (typeof text === 'string' && text !== '[object Object]') {
        return normalizeOutputUrl(text);
      }
    }
  } catch {
    // Ignore non-URL object stringification.
  }

  return '';
}

export async function POST(request: Request) {
  try {
    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json({ error: 'Replicate API token is not configured.' }, { status: 500 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: '잘못된 JSON 요청입니다.' }, { status: 400 });
    }

    const {
      brandId,
      prompt,
      aspectRatio,
      seed,
      subjectPrompt,
      lighting,
      camera,
      vibe,
      background,
      promptMode,
    } = body;
    const safePrompt = normalizePrompt(prompt);
    const safeSubjectPrompt = normalizePrompt(subjectPrompt);
    const safeLighting = normalizePromptOption(lighting);
    const safeCamera = normalizePromptOption(camera);
    const safeVibe = normalizePromptOption(vibe);
    const safeBackground = normalizePromptOption(background);
    const safePromptMode = normalizePromptMode(promptMode);
    const safeAspectRatio = normalizeAspectRatio(aspectRatio);
    const finalSeed = normalizeSeed(seed);
    const context = await getBrandManagerContext();
    if (context.response) return context.response;
    const supabase = context.admin;

    if (typeof brandId !== 'string' || !isSafeIdentifierParam(brandId) || !safePrompt) {
      return NextResponse.json({ error: '브랜드와 프롬프트가 필요합니다.' }, { status: 400 });
    }

    if (finalSeed === null) {
      return NextResponse.json({ error: 'Seed must be an integer between 0 and 4294967295.' }, { status: 400 });
    }

    const { data: brand } = await supabase
      .from('brands')
      .select('id, trigger_word, user_id')
      .eq('id', brandId)
      .eq('user_id', context.user.id)
      .maybeSingle();

    if (!brand) {
      return NextResponse.json({ error: '브랜드를 찾을 수 없거나 권한이 없습니다.' }, { status: 404 });
    }

    // 1. 모델 정보 조회
    const { data: model, error: modelError } = await supabase.from('trained_models')
      .select('id, status, replicate_training_id')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (modelError) {
      throw modelError;
    }

    if (!model) {
      return NextResponse.json({ error: '학습된 모델이 없습니다.' }, { status: 400 });
    }

    if (!model.replicate_training_id) {
      return NextResponse.json({ error: '학습 정보가 올바르지 않습니다.' }, { status: 400 });
    }

    // 2. 학습 정보 확인 (Lazy Check)
    const replicateTrainingId = model.replicate_training_id;
    debugLog('Fetching training info...');
    
    const training = await replicate.trainings.get(replicateTrainingId) as ReplicateTraining;

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

    debugLog(`Generating with Seed: ${finalSeed} (User input: ${seed ? 'Yes' : 'No'})`);

    const inputParams: Record<string, string | number | boolean> = {
      prompt: `${safePrompt}, ${brand.trigger_word}`,
      lora_scale: 0.9,
      num_inference_steps: 28,
      disable_safety_checker: true,
      output_format: "jpg",
      aspect_ratio: safeAspectRatio,
      seed: finalSeed
    };

    const output = await replicate.run(fullModelId as Parameters<typeof replicate.run>[0], {
      input: inputParams
    });

    const replicateImageUrl = normalizeOutputUrl(output);
    if (!replicateImageUrl) {
      throw new Error('Generated image URL is invalid.');
    }

    // 4. 저장 로직
    const imageRes = await fetch(replicateImageUrl, { signal: AbortSignal.timeout(30_000) });
    if (!imageRes.ok) {
      throw new Error('Failed to download generated image.');
    }

    const contentType = imageRes.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      throw new Error(`Generated output is not an image: ${contentType}`);
    }

    const contentLength = Number(imageRes.headers.get('content-length') || 0);
    if (contentLength > MAX_GENERATED_IMAGE_BYTES) {
      throw new Error('Generated image is too large.');
    }

    const imageBlob = await imageRes.blob();
    if (imageBlob.size > MAX_GENERATED_IMAGE_BYTES) {
      throw new Error('Generated image is too large.');
    }

    const fileName = `${brandId}/${Date.now()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('generated-images')
      .upload(fileName, imageBlob, { cacheControl: '31536000', contentType: 'image/jpeg' });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('generated-images')
      .getPublicUrl(fileName);

    const baseGeneratedImage = {
      brand_id: brandId,
      image_url: publicUrl,
      prompt: safePrompt,
      aspect_ratio: safeAspectRatio,
      seed: finalSeed,
      user_id: context.user.id
    };
    const metadataGeneratedImage = {
      ...baseGeneratedImage,
      subject_prompt: safeSubjectPrompt || null,
      lighting: safeLighting || null,
      camera: safeCamera || null,
      vibe: safeVibe || null,
      background: safeBackground || null,
      prompt_mode: safePromptMode,
    };

    // 5. DB에 기록 (작성자 ID 포함!)
    const { error: insertError } = await supabase
      .from('generated_images')
      .insert(metadataGeneratedImage);

    if (insertError) {
      if (!isMissingGenerationMetadataColumn(insertError)) {
        throw insertError;
      }

      const { error: fallbackInsertError } = await supabase
        .from('generated_images')
        .insert(baseGeneratedImage);

      if (fallbackInsertError) throw fallbackInsertError;
    }

    return NextResponse.json({ 
      success: true, 
      imageUrl: publicUrl, 
      status: 'succeeded',
      seed: finalSeed 
    });

  } catch (error: unknown) {
    console.error('Gen Error:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
