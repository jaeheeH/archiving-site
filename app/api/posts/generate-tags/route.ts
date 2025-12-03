import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || '');

export async function POST(req: NextRequest) {
  try {
    if (!apiKey) {
      return NextResponse.json({ error: 'API Key not found' }, { status: 500 });
    }

    const { title, subtitle, content } = await req.json();

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

    if (!title && textContent.length < 10) {
       return NextResponse.json(
        { error: '내용이 너무 짧아 분석할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 모델 설정 (안정성을 위해 1.5-flash 사용 권장)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash', 
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3, // 창의성보다는 정확성 중요
      },
    });

    const prompt = `
      You are a professional blog editor. Analyze the following blog post and generate relevant tags in Korean.
      
      Input Data:
      - Title: "${title || ''}"
      - Subtitle: "${subtitle || ''}"
      - Content (Excerpt): "${textContent.substring(0, 3000)}"

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

    let parsedData = { tags: [] };
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

    return NextResponse.json({
      success: true,
      tags: parsedData.tags || [],
    });

  } catch (error: any) {
    console.error('❌ Tag Generation Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// TipTap JSON 구조에서 텍스트만 발라내는 함수
function extractTextFromTipTap(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') return content; // 이미 텍스트인 경우

  let text = '';

  if (content.type === 'text' && content.text) {
    text += content.text + ' ';
  }

  if (content.content && Array.isArray(content.content)) {
    content.content.forEach((child: any) => {
      text += extractTextFromTipTap(child);
    });
  }

  return text.trim();
}