import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkPostOwnershipOrAdmin } from '@/lib/supabase/post-utils';
import { assertNewsProject } from '@/lib/news-pipeline';
import { NEWS_FORMAT } from '@/lib/news-record';

const decisionSchema = z.object({ decision: z.enum(['allow', 'exclude']) }).strict();
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const permission = await checkPostOwnershipOrAdmin(id);
  if (!permission.authorized) return permission.error;
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 });
  try {
    assertNewsProject(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    const text = await request.text();
    if (text.length > 2048) return Response.json({ error: '요청 크기를 확인해주세요.' }, { status: 413 });
    const input = decisionSchema.safeParse(JSON.parse(text));
    if (!input.success) return Response.json({ error: '중복 검토 선택을 확인해주세요.' }, { status: 400 });
    const db = createAdminClient();
    const { data: post, error } = await db.from('posts').select('content,is_published,updated_at').eq('id', id).eq('type', 'news').maybeSingle();
    if (error) throw error;
    if (!post || post.is_published || post.content?.format !== NEWS_FORMAT || post.content.paragraphs !== undefined || post.content.automation?.status !== 'duplicate' || !['pending', 'excluded'].includes(post.content.duplicate_review?.status)) {
      return Response.json({ error: '미작성 중복 후보만 검토할 수 있습니다. 목록을 새로고침해주세요.' }, { status: 409 });
    }
    const now = new Date().toISOString();
    const saved = await db.from('posts').update({ content: { ...post.content,
      duplicate_review: { ...post.content.duplicate_review, status: input.data.decision === 'allow' ? 'allowed' : 'excluded', reviewed_by: permission.userId, reviewed_at: now },
      ...(input.data.decision === 'allow' ? { automation: undefined } : {}) }, updated_at: now })
      .eq('id', id).filter('author_id', permission.post.author_id === null ? 'is' : 'eq', permission.post.author_id || 'null').eq('is_published', false).eq('updated_at', post.updated_at).eq('content->automation->>status', 'duplicate').select('id').maybeSingle();
    if (saved.error) throw saved.error;
    if (!saved.data) return Response.json({ error: '기사가 변경되었습니다. 새로고침 후 다시 검토해주세요.' }, { status: 409 });
    return Response.json({ saved: true }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (cause) {
    return Response.json({ error: cause instanceof SyntaxError ? '요청 형식을 확인해주세요.' : '중복 검토 선택을 저장하지 못했습니다.' }, { status: cause instanceof SyntaxError ? 400 : 503 });
  }
}
