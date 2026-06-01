import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import GalleryDetailClient from './GalleryDetailClient';
import { getGalleryDetailData } from '@/lib/public-data';
import { createPublicClient } from '@/lib/supabase/public';
import { Suspense } from 'react';

interface Props {
  params: Promise<{ id: string }>;
}

const STATIC_GALLERY_PARAMS_LIMIT = 100;

export const revalidate = 86400;

export async function generateStaticParams() {
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from('gallery')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(STATIC_GALLERY_PARAMS_LIMIT);

    if (error) {
      console.error('Failed to fetch gallery ids for static generation:', error);
      return [];
    }

    return (data || []).map((item) => ({
      id: String(item.id),
    }));
  } catch (error) {
    console.error('Error in gallery generateStaticParams:', error);
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await getGalleryDetailData(Number(id));

  if (!data?.gallery) return { title: 'Gallery Not Found' };

  const { gallery } = data;

  return {
    title: `${gallery.title} | Archiving Site`,
    description: gallery.description || 'AI Generated Art Gallery',
    openGraph: {
      title: gallery.title,
      description: gallery.description || undefined,
      images: [{ url: gallery.image_url, alt: gallery.title }],
    },
  };
}

export default async function GalleryDetailPage({ params }: Props) {
  const { id } = await params;
  const currentId = parseInt(id);
  const data = await getGalleryDetailData(currentId);

  if (!data?.gallery) {
    notFound();
  }

  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <GalleryDetailClient 
        gallery={data.gallery} 
        prevId={data.prevId}
        nextId={data.nextId}
      />
    </Suspense>
  );
}
