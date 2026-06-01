import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getErrorMessage } from '@/lib/error-message';
import { checkPostEditPermission } from '@/lib/supabase/post-utils';

type TipTapNode = string | {
  type?: string;
  text?: string;
  content?: TipTapNode[];
};

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || '');
const MAX_PROMPT_TITLE_LENGTH = 180;
const MAX_PROMPT_SUBTITLE_LENGTH = 240;
const MAX_PROMPT_CONTENT_LENGTH = 3000;
const MAX_TAG_COUNT = 8;
const MAX_TAG_LENGTH = 30;

function normalizePromptText(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function normalizeTags(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => tag.replace(/^#+/, '').trim().slice(0, MAX_TAG_LENGTH))
        .filter(Boolean)
    )
  ).slice(0, MAX_TAG_COUNT);
}

async function parseJsonObject(req: NextRequest) {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const permCheck = await checkPostEditPermission();
    if (!permCheck.authorized) return permCheck.error;

    if (!apiKey) {
      return NextResponse.json({ error: 'API Key not found' }, { status: 500 });
    }

    const body = await parseJsonObject(req);
    if (!body) {
      return NextResponse.json({ error: '잘못된 JSON 요청입니다.' }, { status: 400 });
    }

    const { title, subtitle, content } = body;
    const safeTitle = normalizePromptText(title, MAX_PROMPT_TITLE_LENGTH);
    const safeSubtitle = normalizePromptText(subtitle, MAX_PROMPT_SUBTITLE_LENGTH);

    if (!title && !content) {
      return NextResponse.json(
        { error: '분석할 제목이나 본문 내용이 필요합니다.' },
        { status: 400 }
      );
    }

    // 텍스트 추출 (TipTap JSON -> Plain Text)
    let textContent = '';
    if (content) {
      textContent = extractTextFromTipTap(content);
    }
    const promptContent = textContent.slice(0, MAX_PROMPT_CONTENT_LENGTH);

    if (!safeTitle && textContent.length < 10) {
       return NextResponse.json(
        { error: '내용이 너무 짧아 분석할 수 없습니다.' },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3, // 창의성보다는 정확성 중요
        maxOutputTokens: 300,
      },
    });

    const prompt = `
      You are a professional blog editor. Analyze the following blog post and generate relevant tags in Korean.
      
      Input Data:
      - Title: "${safeTitle}"
      - Subtitle: "${safeSubtitle}"
      - Content (Excerpt): "${promptContent}"

      Requirements:
      1. Extract 5 to 8 most relevant keywords.
      2. Tags must be in Korean (Hangul).
      3. Do not include the '#' symbol.
      4. Include specific proper nouns (e.g., "React", "Seoul") if they are key topics.
      5. Include broad categories (e.g., "Development", "Travel") if applicable.

      Output Format (JSON):
      {
        "tags": ["tag1", "tag2", "tag3", ...]
      }
    `;

    const result = await model.generateContent(prompt);
    const jsonText = result.response.text();

    let parsedData: { tags: string[] } = { tags: [] };
    try {
      parsedData = JSON.parse(jsonText);
    } catch (e) {
      console.error('JSON Parse Error:', e);
      // JSON 파싱 실패 시 텍스트에서 강제 추출 시도 (백업 로직)
      const matches = jsonText.match(/"([^"]+)"/g);
      if (matches) {
          const rawTags = matches.map(s => s.replace(/"/g, '')).filter(t => t !== 'tags');
          parsedData = { tags: rawTags };
      }
    }
    const tags = normalizeTags(parsedData.tags);

    return NextResponse.json({
      success: true,
      tags,
    });

  } catch (error: unknown) {
    console.error('❌ Tag Generation Error:', error);
    return NextResponse.json({ error: getErrorMessage(error, 'Internal Server Error') }, { status: 500 });
  }
}

// TipTap JSON 구조에서 텍스트만 발라내는 함수
function extractTextFromTipTap(content: TipTapNode | null | undefined): string {
  if (!content) return '';
  if (typeof content === 'string') return content; // 이미 텍스트인 경우

  let text = '';

  if (content.type === 'text' && content.text) {
    text += content.text + ' ';
  }

  if (content.content && Array.isArray(content.content)) {
    content.content.forEach((child) => {
      text += extractTextFromTipTap(child);
    });
  }

  return text.trim();
}
