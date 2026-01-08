import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { checkGalleryOwnershipOrAdmin } from '@/lib/supabase/gallery-utils';
import GalleryDetailClient from './GalleryDetailClient';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('gallery')
    .select('title, description, image_url')
    .eq('id', id)
    .single();

  if (!data) return { title: 'Gallery Not Found' };

  return {
    title: `${data.title} | Archiving Site`,
    description: data.description || 'AI Generated Art Gallery',
    openGraph: {
      title: data.title,
      description: data.description || undefined,
      images: [{ url: data.image_url, alt: data.title }],
    },
  };
}

export default async function GalleryDetailPage({ params }: Props) {
  const { id } = await params;
  const currentId = parseInt(id);
  const supabase = await createClient();

  // 1. 현재 갤러리 데이터 조회
  const { data: gallery, error } = await supabase
    .from('gallery')
    .select('*')
    .eq('id', currentId)
    .single();

  if (error || !gallery) {
    notFound();
  }

  // 2. 권한 체크 (수정/삭제 버튼 노출 여부)
  const { authorized: canEdit } = await checkGalleryOwnershipOrAdmin(currentId);

  // 3. 이전/다음 글 ID 조회 (단순 ID 기준, 최신순 정렬 가정)
  // Next (Newer): ID가 현재보다 큰 것 중 가장 작은 것 (오름차순 limit 1)
  const { data: nextData } = await supabase
    .from('gallery')
    .select('id')
    .gt('id', currentId)
    .order('id', { ascending: true })
    .limit(1)
    .single();

  // Prev (Older): ID가 현재보다 작은 것 중 가장 큰 것 (내림차순 limit 1)
  const { data: prevData } = await supabase
    .from('gallery')
    .select('id')
    .lt('id', currentId)
    .order('id', { ascending: false })
    .limit(1)
    .single();

  return (
    <GalleryDetailClient 
      gallery={gallery} 
      canEdit={canEdit}
      nextId={nextData?.id ?? null}
      prevId={prevData?.id ?? null}
    />
  );
}