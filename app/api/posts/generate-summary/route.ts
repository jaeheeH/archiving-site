import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getErrorMessage } from '@/lib/error-message';
import { checkPostEditPermission } from '@/lib/supabase/post-utils';

type TipTapNode = {
  text?: unknown;
  content?: unknown;
};

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || '');
const MAX_PROMPT_TITLE_LENGTH = 180;
const MAX_PROMPT_SUBTITLE_LENGTH = 240;
const MAX_PROMPT_CONTENT_LENGTH = 3000;
const MAX_SUMMARY_LENGTH = 700;

function normalizePromptText(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
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
      return NextResponse.json({ error: 'No content to summarize' }, { status: 400 });
    }

    // Tiptap JSON -> 텍스트 추출 함수
    const extractText = (node: unknown): string => {
      if (!node) return '';
      if (typeof node === 'string') return node;
      if (typeof node !== 'object' || Array.isArray(node)) return '';
      const contentNode = node as TipTapNode;
      let text = '';
      if (typeof contentNode.text === 'string') text += contentNode.text + ' ';
      if (Array.isArray(contentNode.content)) {
        contentNode.content.forEach((child) => {
          text += extractText(child);
        });
      }
      return text.trim();
    };

    const textContent = extractText(content);
    const promptContent = textContent.slice(0, MAX_PROMPT_CONTENT_LENGTH);

    if (textContent.length < 20) {
      return NextResponse.json({ summary: '' }); // 너무 짧으면 요약 안 함
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        maxOutputTokens: 800, // 너무 길지 않게 제한
        temperature: 0.3,
      },
    });

    const prompt = `
      You are a professional editor. Summarize the following blog post in Korean.
      
      Input:
      - Title: "${safeTitle}"
      - Subtitle: "${safeSubtitle}"
      - Content: "${promptContent}"

      Requirements:
      1. Create a concise summary (4-6 sentences).
      2. It should be engaging, like a preview text for a blog card.
      3. Language: Korean (Hangul).
      4. Plain text only (no markdown).

      Output:
    `;

    const result = await model.generateContent(prompt);
    const summary = result.response.text().trim().slice(0, MAX_SUMMARY_LENGTH);

    return NextResponse.json({
      success: true,
      summary: summary,
    });

  } catch (error: unknown) {
    console.error('❌ Summary Generation Error:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
