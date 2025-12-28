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
      return NextResponse.json({ error: 'No content to summarize' }, { status: 400 });
    }

    // Tiptap JSON -> 텍스트 추출 함수
    const extractText = (content: any): string => {
      if (!content) return '';
      if (typeof content === 'string') return content;
      let text = '';
      if (content.text) text += content.text + ' ';
      if (content.content && Array.isArray(content.content)) {
        content.content.forEach((child: any) => {
          text += extractText(child);
        });
      }
      return text.trim();
    };

    const textContent = extractText(content);

    if (textContent.length < 20) {
      return NextResponse.json({ summary: '' }); // 너무 짧으면 요약 안 함
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash', // 빠르고 효율적인 모델
      generationConfig: {
        maxOutputTokens: 800, // 너무 길지 않게 제한
        temperature: 0.3,
      },
    });

    const prompt = `
      You are a professional editor. Summarize the following blog post in Korean.
      
      Input:
      - Title: "${title}"
      - Subtitle: "${subtitle}"
      - Content: "${textContent.substring(0, 3000)}"

      Requirements:
      1. Create a concise summary (4-6 sentences).
      2. It should be engaging, like a preview text for a blog card.
      3. Language: Korean (Hangul).
      4. Plain text only (no markdown).

      Output:
    `;

    const result = await model.generateContent(prompt);
    const summary = result.response.text().trim();

    return NextResponse.json({
      success: true,
      summary: summary,
    });

  } catch (error: any) {
    console.error('❌ Summary Generation Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}